import { RegisterBookService } from "Application/Services/Book/RegisterBookService";
import { ITransactionManager } from "Application/Shared/ITransactionManager";
import { Book } from "Domain/Models/Book/Book";
import { BookAlreadyExistsError } from "Domain/Models/Book/BookAlreadyExistsError";
import { BookId } from "Domain/Models/Book/BookId";
import { IBookRepository } from "Domain/Models/Book/IBookRepository";
import { Price } from "Domain/Models/Book/Price";
import { IReviewRepository } from "Domain/Models/Review/IReviewRepository";
import { ReviewId } from "Domain/Models/Review/ReviewId";
import { Threshold } from "Domain/Models/Review/Threshold";
import { TransactionAbortedError } from "Infrastructure/Shared/TransactionAbortedError";

import {
  BOOK_ID_1,
  BOOK_ID_2,
  bookValues,
  deferred,
  delay,
  makeBook,
  makeReview,
  reviewIdOf,
  reviewValues,
} from "./Fixtures";

/** 1つのテストで使う、同じ永続化先を共有するポート実装の組。 */
export type RepositoryHarness = {
  bookRepository: IBookRepository;
  reviewRepository: IReviewRepository;
  transactionManager: ITransactionManager;
};

/**
 * IBookRepository / IReviewRepository / ITransactionManager のポート契約。
 * InMemory と SQL の両方の実装に同じテストを適用し、両者が同じ契約を満たすことを検証する。
 * createHarness はテストごとに空の永続化先を用意する。
 */
export const describeRepositoryContract = (createHarness: () => Promise<RepositoryHarness>): void => {
  let h: RepositoryHarness;

  beforeEach(async () => {
    h = await createHarness();
  });

  describe("IBookRepository", () => {
    it("保存した書籍を findById で同じ値の集約として再構成できる", async () => {
      const book = makeBook();
      await h.bookRepository.save(book);

      const found = await h.bookRepository.findById(new BookId(BOOK_ID_1));

      expect(found).toBeInstanceOf(Book);
      expect(bookValues(found)).toEqual(bookValues(book));
      expect(found?.equals(book)).toBe(true);
    });

    it("未登録の書籍IDでは null を返す", async () => {
      expect(await h.bookRepository.findById(new BookId(BOOK_ID_2))).toBeNull();
    });

    it("値オブジェクトの境界値（最小・最大、サロゲートペアを含む最大長）を損なわずに保存・再構成できる", async () => {
      // 🍣 は string.length で 2（UTF-16 コード単位）。ドメインの上限 1000 / 100 ちょうどにする
      const min = makeBook({ bookId: BOOK_ID_1, title: "A", author: "B", price: Price.MIN });
      const max = makeBook({ bookId: BOOK_ID_2, title: "🍣".repeat(500), author: "著".repeat(100), price: Price.MAX });
      await h.bookRepository.save(min);
      await h.bookRepository.save(max);

      expect(bookValues(await h.bookRepository.findById(min.bookId))).toEqual(bookValues(min));
      expect(bookValues(await h.bookRepository.findById(max.bookId))).toEqual(bookValues(max));
    });

    it("同じ書籍IDを保存すると BookAlreadyExistsError を投げ、既存の書籍を上書きしない", async () => {
      await h.bookRepository.save(makeBook({ title: "元のタイトル" }));

      const error = await h.bookRepository.save(makeBook({ title: "別のタイトル" })).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BookAlreadyExistsError);
      expect((error as BookAlreadyExistsError).bookId.value).toBe(BOOK_ID_1);
      expect((await h.bookRepository.findById(new BookId(BOOK_ID_1)))?.title.value).toBe("元のタイトル");
    });

    it("取得した集約を変更しても、保存しない限り永続化された値は変わらない", async () => {
      const book = makeBook({ price: 3200 });
      await h.bookRepository.save(book);
      book.changePrice(new Price(1));

      const found = await h.bookRepository.findById(book.bookId);
      found?.changePrice(new Price(2));

      expect((await h.bookRepository.findById(book.bookId))?.price.value).toBe(3200);
    });

    it("同じ書籍IDを別々のトランザクションで同時に保存すると、片方だけが成功し、もう片方は BookAlreadyExistsError になる", async () => {
      const results = await Promise.allSettled([
        h.transactionManager.begin(() => h.bookRepository.save(makeBook({ title: "先" }))),
        h.transactionManager.begin(() => h.bookRepository.save(makeBook({ title: "後" }))),
      ]);

      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(BookAlreadyExistsError);
      expect(await h.bookRepository.findById(new BookId(BOOK_ID_1))).not.toBeNull();
    });
  });

  describe("IReviewRepository", () => {
    it("保存したレビューを findById で同じ値の集約として再構成でき、振る舞いの結果も変わらない", async () => {
      const review = makeReview({
        comment: "『オブジェクト指向入門』を読んでおくと理解しやすいです。『リファクタリング』もおすすめです。",
      });
      await h.reviewRepository.save(review);

      const found = await h.reviewRepository.findById(review.reviewId);

      expect(reviewValues(found)).toEqual(reviewValues(review));
      expect(found?.extractRecommendedBooks()).toEqual(["オブジェクト指向入門", "リファクタリング"]);
      expect(found?.calculateReliability()).toBe(review.calculateReliability());
      expect(found?.isTrustworthy(Threshold.default())).toBe(true);
    });

    it("コメントなし（null）と匿名投稿（名無し）をそのまま保存・再構成できる", async () => {
      const review = makeReview({ name: "名無し", comment: null });
      await h.reviewRepository.save(review);

      const found = await h.reviewRepository.findById(review.reviewId);

      expect(found?.comment).toBeNull();
      expect(found?.name.value).toBe("名無し");
    });

    it("値オブジェクトの最大長（投稿者名 50 文字、コメント 1000 文字）を保存・再構成できる", async () => {
      const review = makeReview({ name: "名".repeat(50), rating: 1, comment: "あ".repeat(1000) });
      await h.reviewRepository.save(review);

      expect(reviewValues(await h.reviewRepository.findById(review.reviewId))).toEqual(reviewValues(review));
    });

    it("未登録のレビューIDでは null を返す", async () => {
      expect(await h.reviewRepository.findById(new ReviewId(reviewIdOf(99)))).toBeNull();
    });

    it("同じレビューIDを保存すると例外を投げ、既存のレビューを上書きしない", async () => {
      await h.reviewRepository.save(makeReview({ name: "元の投稿者" }));

      await expect(h.reviewRepository.save(makeReview({ name: "別の投稿者" }))).rejects.toThrow();
      expect((await h.reviewRepository.findById(new ReviewId(reviewIdOf(1))))?.name.value).toBe("元の投稿者");
    });

    it("update は ReviewId 以外の属性（BookId・投稿者名・評価・コメント）をすべて置き換える", async () => {
      await h.reviewRepository.save(makeReview());
      const updated = makeReview({ bookId: BOOK_ID_2, name: "名無し", rating: 2, comment: null });

      await h.reviewRepository.update(updated);

      expect(reviewValues(await h.reviewRepository.findById(updated.reviewId))).toEqual(reviewValues(updated));
    });

    it("update は該当するレビューがなければ何もしない（作成しない・例外を投げない）", async () => {
      await expect(h.reviewRepository.update(makeReview({ reviewId: reviewIdOf(5) }))).resolves.toBeUndefined();

      expect(await h.reviewRepository.findById(new ReviewId(reviewIdOf(5)))).toBeNull();
    });

    it("delete は指定したレビューだけを削除する", async () => {
      await h.reviewRepository.save(makeReview({ reviewId: reviewIdOf(1) }));
      await h.reviewRepository.save(makeReview({ reviewId: reviewIdOf(2) }));

      await h.reviewRepository.delete(new ReviewId(reviewIdOf(1)));

      expect(await h.reviewRepository.findById(new ReviewId(reviewIdOf(1)))).toBeNull();
      expect(await h.reviewRepository.findById(new ReviewId(reviewIdOf(2)))).not.toBeNull();
    });

    it("delete は該当するレビューがなければ何もしない", async () => {
      await expect(h.reviewRepository.delete(new ReviewId(reviewIdOf(9)))).resolves.toBeUndefined();
    });

    it("findAllByBookId は指定した書籍のレビューだけを、保存順に関係なく review_id の昇順で返す", async () => {
      await h.reviewRepository.save(makeReview({ reviewId: reviewIdOf(3), bookId: BOOK_ID_1 }));
      await h.reviewRepository.save(makeReview({ reviewId: reviewIdOf(1), bookId: BOOK_ID_1 }));
      await h.reviewRepository.save(makeReview({ reviewId: reviewIdOf(2), bookId: BOOK_ID_2 }));
      await h.reviewRepository.save(makeReview({ reviewId: reviewIdOf(4), bookId: BOOK_ID_1 }));

      const found = await h.reviewRepository.findAllByBookId(new BookId(BOOK_ID_1));

      expect(found.map((r) => r.reviewId.value)).toEqual([reviewIdOf(1), reviewIdOf(3), reviewIdOf(4)]);
    });

    it("findAllByBookId はレビューがなければ空配列を返す", async () => {
      expect(await h.reviewRepository.findAllByBookId(new BookId(BOOK_ID_2))).toEqual([]);
    });

    it("同じレビューを同時に更新すると、後から更新したトランザクションの値が残る（後勝ち）", async () => {
      await h.reviewRepository.save(makeReview());
      const firstUpdated = deferred();
      const releaseFirst = deferred();

      const first = h.transactionManager.begin(async () => {
        await h.reviewRepository.update(makeReview({ name: "先に更新" }));
        firstUpdated.resolve();
        await releaseFirst.promise;
      });
      await firstUpdated.promise;
      const second = h.transactionManager.begin(() => h.reviewRepository.update(makeReview({ name: "後から更新" })));
      // 後のトランザクションが先のトランザクションの終了を待つ状態になってから、先のトランザクションを終える
      await delay(50);
      releaseFirst.resolve();
      await Promise.all([first, second]);

      expect((await h.reviewRepository.findById(new ReviewId(reviewIdOf(1))))?.name.value).toBe("後から更新");
    });
  });

  describe("ITransactionManager", () => {
    it("callback が正常に終わるとコミットし、callback の戻り値を返す", async () => {
      const result = await h.transactionManager.begin(async () => {
        await h.bookRepository.save(makeBook());
        await h.reviewRepository.save(makeReview());
        return "done";
      });

      expect(result).toBe("done");
      expect(await h.bookRepository.findById(new BookId(BOOK_ID_1))).not.toBeNull();
      expect(await h.reviewRepository.findById(new ReviewId(reviewIdOf(1)))).not.toBeNull();
    });

    it("callback が例外を投げると、複数の集約への書き込みをすべてロールバックし、同じ例外を再送出する", async () => {
      await h.reviewRepository.save(makeReview({ reviewId: reviewIdOf(2) }));
      const failure = new Error("途中で失敗");

      const error = await h.transactionManager
        .begin(async () => {
          await h.bookRepository.save(makeBook());
          await h.reviewRepository.save(makeReview({ reviewId: reviewIdOf(1) }));
          await h.reviewRepository.update(makeReview({ reviewId: reviewIdOf(2), name: "更新後" }));
          await h.reviewRepository.delete(new ReviewId(reviewIdOf(2)));
          throw failure;
        })
        .catch((e: unknown) => e);

      expect(error).toBe(failure);
      expect(await h.bookRepository.findById(new BookId(BOOK_ID_1))).toBeNull();
      expect(await h.reviewRepository.findById(new ReviewId(reviewIdOf(1)))).toBeNull();
      expect((await h.reviewRepository.findById(new ReviewId(reviewIdOf(2))))?.name.value).toBe("読書家A");
    });

    it("トランザクション内では自分の未コミットの書き込みが読め、トランザクション外からはコミットまで見えない", async () => {
      const saved = deferred();
      const releaseTx = deferred();
      let seenInside: Book | null = null;

      const tx = h.transactionManager.begin(async () => {
        await h.bookRepository.save(makeBook());
        seenInside = await h.bookRepository.findById(new BookId(BOOK_ID_1));
        saved.resolve();
        await releaseTx.promise;
      });
      await saved.promise;
      const seenOutsideBeforeCommit = await h.bookRepository.findById(new BookId(BOOK_ID_1));
      releaseTx.resolve();
      await tx;

      expect(seenInside).not.toBeNull();
      expect(seenOutsideBeforeCommit).toBeNull();
      expect(await h.bookRepository.findById(new BookId(BOOK_ID_1))).not.toBeNull();
    });

    it("トランザクション内で begin を呼ぶと外側のトランザクションに参加し、外側の失敗で内側の書き込みもロールバックされる", async () => {
      await expect(
        h.transactionManager.begin(async () => {
          await h.transactionManager.begin(() => h.bookRepository.save(makeBook()));
          throw new Error("外側で失敗");
        }),
      ).rejects.toThrow("外側で失敗");

      expect(await h.bookRepository.findById(new BookId(BOOK_ID_1))).toBeNull();
    });

    it("callback が書き込みの失敗を catch して正常終了しても成功扱いにせず、TransactionAbortedError を投げて何も残さない", async () => {
      await h.bookRepository.save(makeBook({ bookId: BOOK_ID_2 }));

      const error = await h.transactionManager
        .begin(async () => {
          await h.reviewRepository.save(makeReview());
          // 主キー違反（BookAlreadyExistsError）を握りつぶす
          await h.bookRepository.save(makeBook({ bookId: BOOK_ID_2 })).catch(() => undefined);
          return "成功したつもり";
        })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(TransactionAbortedError);
      expect(await h.reviewRepository.findById(new ReviewId(reviewIdOf(1)))).toBeNull();
    });

    it("書き込みが失敗したトランザクションでは、トランザクションが終わるまで以降の読み書きを受け付けない", async () => {
      await h.bookRepository.save(makeBook());
      let afterFailure: unknown;

      await h.transactionManager
        .begin(async () => {
          await h.bookRepository.save(makeBook()).catch(() => undefined);
          afterFailure = await h.reviewRepository.findById(new ReviewId(reviewIdOf(1))).catch((e: unknown) => e);
        })
        .catch(() => undefined);

      expect(afterFailure).toBeInstanceOf(Error);
      // 中断状態はそのトランザクションに限られる
      expect(await h.bookRepository.findById(new BookId(BOOK_ID_1))).not.toBeNull();
    });

    it("内側の begin の失敗を外側の callback が catch しても、外側のトランザクションは TransactionAbortedError になる", async () => {
      await h.bookRepository.save(makeBook({ bookId: BOOK_ID_2 }));

      const error = await h.transactionManager
        .begin(async () => {
          await h.bookRepository.save(makeBook({ bookId: BOOK_ID_1 }));
          await h.transactionManager
            .begin(() => h.bookRepository.save(makeBook({ bookId: BOOK_ID_2 })))
            .catch(() => undefined);
        })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(TransactionAbortedError);
      expect(await h.bookRepository.findById(new BookId(BOOK_ID_1))).toBeNull();
    });

    it("失敗したトランザクションの後も、続くトランザクションを実行できる", async () => {
      for (let i = 0; i < 15; i++) {
        await expect(h.transactionManager.begin(() => Promise.reject(new Error(`失敗${i}`)))).rejects.toThrow();
      }

      await h.transactionManager.begin(() => h.bookRepository.save(makeBook()));

      expect(await h.bookRepository.findById(new BookId(BOOK_ID_1))).not.toBeNull();
    });
  });

  describe("ユースケースとの結合（UC-BOOK-001）", () => {
    it("同じ書籍IDの書籍登録が同時に来ても1件だけ登録され、もう片方は BOOK_ALREADY_EXISTS になる", async () => {
      const service = new RegisterBookService(h.bookRepository, h.transactionManager);
      const command = { bookId: BOOK_ID_1, title: "ドメイン駆動設計入門", author: "山田太郎", price: 3200 };

      const results = await Promise.all([service.execute(command), service.execute(command)]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok).map((r) => (r.ok ? null : r.error.code))).toEqual(["BOOK_ALREADY_EXISTS"]);
    });
  });
};

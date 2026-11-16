import { Author } from "Domain/Models/Book/Author";
import { Book } from "Domain/Models/Book/Book";
import { BookId } from "Domain/Models/Book/BookId";
import { Price } from "Domain/Models/Book/Price";
import { Title } from "Domain/Models/Book/Title";
import { RegisterReviewCommand, RegisterReviewService } from "Application/Services/Review/RegisterReviewService";

import { FakeBookRepository, FakeReviewRepository } from "../../TestDoubles/FakeRepositories";
import { FakeTransactionManager } from "../../TestDoubles/FakeTransactionManager";

const BOOK_ID = "9784000000000";
const book = new Book(new BookId(BOOK_ID), new Title("本"), new Author("著者"), new Price(1000));

const command: RegisterReviewCommand = {
  bookId: BOOK_ID,
  name: "山田",
  rating: 4,
  comment: "『前提の本』を読むと理解が深まる",
};

const setup = (books: Book[] = [book]) => {
  const tx = new FakeTransactionManager();
  const bookRepository = new FakeBookRepository(tx, books);
  const reviewRepository = new FakeReviewRepository(tx);
  return {
    tx,
    bookRepository,
    reviewRepository,
    service: new RegisterReviewService(bookRepository, reviewRepository, tx),
  };
};

describe("RegisterReviewService（UC-REVIEW-001 レビューの登録）", () => {
  it("書籍が登録済みならレビューを保存し、採番した ReviewId を含むレビューDTOを返す", async () => {
    const { service, reviewRepository, tx } = setup();

    const result = await service.execute(command);

    if (!result.ok) throw new Error("成功するはず");
    expect(result.data).toEqual({ ...command, reviewId: expect.stringMatching(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/) });
    expect(reviewRepository.reviews.get(result.data.reviewId)?.name.value).toBe("山田");
    expect(tx.events).toEqual(["begin", "commit"]);
  });

  it("書籍の存在確認と保存を同じトランザクション内で、この順に行う", async () => {
    const { service, bookRepository, reviewRepository } = setup();

    await service.execute(command);

    expect(bookRepository.calls).toEqual([{ method: "findById", inTransaction: true }]);
    expect(reviewRepository.calls).toEqual([{ method: "save", inTransaction: true }]);
  });

  it("投稿者名が省略（null）なら匿名投稿として「名無し」で登録する", async () => {
    const { service } = setup();

    const result = await service.execute({ ...command, name: null });

    expect(result.ok && result.data.name).toBe("名無し");
  });

  it("コメントが null ならコメントなしで登録する", async () => {
    const { service } = setup();

    const result = await service.execute({ ...command, comment: null });

    expect(result.ok && result.data.comment).toBeNull();
  });

  it("推薦キーワードを伴わない『』を含むコメントもエラーにせず登録する", async () => {
    const { service } = setup();

    const result = await service.execute({ ...command, comment: "『関係ない本』の話" });

    expect(result.ok).toBe(true);
  });

  it("書籍が登録されていなければ保存せず BOOK_NOT_FOUND を返す", async () => {
    const { service, reviewRepository, tx } = setup([]);

    const result = await service.execute(command);

    expect(result).toEqual({
      ok: false,
      error: { code: "BOOK_NOT_FOUND", message: expect.stringContaining(BOOK_ID) },
    });
    expect(reviewRepository.calls).toEqual([]);
    // 書き込み前の業務エラーなので、ロールバックではなくコミットで終える
    expect(tx.events).toEqual(["begin", "commit"]);
  });

  it.each([
    ["書籍IDが13文字でない", { bookId: "123" }],
    ["投稿者名が空白のみ", { name: "   " }],
    ["投稿者名が51文字", { name: "あ".repeat(51) }],
    ["評価が0", { rating: 0 }],
    ["評価が6", { rating: 6 }],
    ["評価が整数でない", { rating: 3.5 }],
    ["コメントが空文字", { comment: "" }],
    ["コメントが1001文字", { comment: "あ".repeat(1001) }],
  ])("入力が不正（%s）なら VALIDATION_ERROR を返し、トランザクションを開始しない", async (_, override) => {
    const { service, tx, bookRepository, reviewRepository } = setup();

    const result = await service.execute({ ...command, ...override });

    expect(!result.ok && result.error.code).toBe("VALIDATION_ERROR");
    expect(tx.events).toEqual([]);
    expect(bookRepository.calls).toEqual([]);
    expect(reviewRepository.calls).toEqual([]);
  });

  it.each([
    ["最小値", { name: "あ", rating: 1, comment: "あ" }],
    ["最大値", { name: "あ".repeat(50), rating: 5, comment: "あ".repeat(1000) }],
  ])("境界値（%s）は登録できる", async (_, override) => {
    const { service } = setup();

    const result = await service.execute({ ...command, ...override });

    expect(result.ok).toBe(true);
  });

  it("書籍リポジトリが失敗したら例外を伝播し、ロールバックする", async () => {
    const { service, bookRepository, reviewRepository, tx } = setup();
    bookRepository.failOn = "findById";

    await expect(service.execute(command)).rejects.toThrow("book repository findById failed");
    expect(tx.events).toEqual(["begin", "rollback"]);
    expect(reviewRepository.calls).toEqual([]);
  });

  it("レビューリポジトリの保存が失敗したら例外を伝播し、ロールバックする", async () => {
    const { service, reviewRepository, tx } = setup();
    reviewRepository.failOn = "save";

    await expect(service.execute(command)).rejects.toThrow("review repository save failed");
    expect(tx.events).toEqual(["begin", "rollback"]);
  });
});

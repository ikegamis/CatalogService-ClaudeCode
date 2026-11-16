import { BookId } from "Domain/Models/Book/BookId";
import { Comment } from "Domain/Models/Review/Comment";
import { Name } from "Domain/Models/Review/Name";
import { Rating } from "Domain/Models/Review/Rating";
import { Review } from "Domain/Models/Review/Review";
import { ReviewId } from "Domain/Models/Review/ReviewId";
import { UpdateReviewCommand, UpdateReviewService } from "Application/Services/Review/UpdateReviewService";

import { FakeReviewRepository } from "../../TestDoubles/FakeRepositories";
import { FakeTransactionManager } from "../../TestDoubles/FakeTransactionManager";

const existing = Review.create(new BookId("9784000000000"), new Name("山田"), new Rating(3), new Comment("元のコメント"));
const REVIEW_ID = existing.reviewId.value;
/** どの書籍リポジトリにも登録されていない書籍ID（更新では書籍の存在を確認しない）。 */
const UNREGISTERED_BOOK_ID = "9784999999999";

const command: UpdateReviewCommand = {
  reviewId: REVIEW_ID,
  bookId: UNREGISTERED_BOOK_ID,
  name: "佐藤",
  rating: 5,
  comment: "書き直したコメント",
};

const setup = () => {
  const tx = new FakeTransactionManager();
  const reviewRepository = new FakeReviewRepository(tx, [existing]);
  return { tx, reviewRepository, service: new UpdateReviewService(reviewRepository, tx) };
};

describe("UpdateReviewService（UC-REVIEW-002 レビューの更新）", () => {
  it("レビューID以外の入力情報で更新し、更新後のレビューDTOを返す", async () => {
    const { service, reviewRepository, tx } = setup();

    const result = await service.execute(command);

    expect(result).toEqual({ ok: true, data: command });
    const updated = reviewRepository.reviews.get(REVIEW_ID);
    expect(updated?.bookId.value).toBe(UNREGISTERED_BOOK_ID);
    expect(updated?.rating.value).toBe(5);
    expect(updated?.equals(existing)).toBe(true);
    expect(tx.events).toEqual(["begin", "commit"]);
  });

  it("レビューの検索と更新を同じトランザクション内で、この順に行う", async () => {
    const { service, reviewRepository } = setup();

    await service.execute(command);

    expect(reviewRepository.calls).toEqual([
      { method: "findById", inTransaction: true },
      { method: "update", inTransaction: true },
    ]);
  });

  it("投稿者名が null なら「名無し」、コメントが null ならコメントなしに更新する", async () => {
    const { service } = setup();

    const result = await service.execute({ ...command, name: null, comment: null });

    expect(result.ok && result.data).toEqual({ ...command, name: "名無し", comment: null });
  });

  it("レビューIDが登録されていなければ更新せず REVIEW_NOT_FOUND を返す", async () => {
    const { service, reviewRepository, tx } = setup();
    const unknownId = ReviewId.generate().value;

    const result = await service.execute({ ...command, reviewId: unknownId });

    expect(result).toEqual({
      ok: false,
      error: { code: "REVIEW_NOT_FOUND", message: expect.stringContaining(unknownId) },
    });
    expect(reviewRepository.calls.map((call) => call.method)).toEqual(["findById"]);
    // 書き込み前の業務エラーなので、ロールバックではなくコミットで終える
    expect(tx.events).toEqual(["begin", "commit"]);
  });

  it.each([
    ["レビューIDがULIDでない", { reviewId: "invalid" }],
    ["書籍IDが13文字でない", { bookId: "123" }],
    ["投稿者名が51文字", { name: "あ".repeat(51) }],
    ["評価が6", { rating: 6 }],
    ["コメントが空文字", { comment: "" }],
  ])("入力が不正（%s）なら VALIDATION_ERROR を返し、トランザクションを開始しない", async (_, override) => {
    const { service, tx, reviewRepository } = setup();

    const result = await service.execute({ ...command, ...override });

    expect(!result.ok && result.error.code).toBe("VALIDATION_ERROR");
    expect(tx.events).toEqual([]);
    expect(reviewRepository.calls).toEqual([]);
  });

  it.each(["findById", "update"] as const)(
    "リポジトリの %s が失敗したら例外を伝播し、ロールバックする",
    async (method) => {
      const { service, reviewRepository, tx } = setup();
      reviewRepository.failOn = method;

      await expect(service.execute(command)).rejects.toThrow(`review repository ${method} failed`);
      expect(tx.events).toEqual(["begin", "rollback"]);
    },
  );
});

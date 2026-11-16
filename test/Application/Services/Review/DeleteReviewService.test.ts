import { BookId } from "Domain/Models/Book/BookId";
import { Rating } from "Domain/Models/Review/Rating";
import { Review } from "Domain/Models/Review/Review";
import { ReviewId } from "Domain/Models/Review/ReviewId";
import { DeleteReviewService } from "Application/Services/Review/DeleteReviewService";

import { FakeReviewRepository } from "../../TestDoubles/FakeRepositories";
import { FakeTransactionManager } from "../../TestDoubles/FakeTransactionManager";

const existing = Review.create(new BookId("9784000000000"), null, new Rating(3), null);
const REVIEW_ID = existing.reviewId.value;

const setup = () => {
  const tx = new FakeTransactionManager();
  const reviewRepository = new FakeReviewRepository(tx, [existing]);
  return { tx, reviewRepository, service: new DeleteReviewService(reviewRepository, tx) };
};

describe("DeleteReviewService（UC-CATALOG-003 レビューの削除）", () => {
  it("登録済みのレビューを削除し、削除したレビューIDを返す", async () => {
    const { service, reviewRepository, tx } = setup();

    const result = await service.execute({ reviewId: REVIEW_ID });

    expect(result).toEqual({ ok: true, data: { reviewId: REVIEW_ID } });
    expect(reviewRepository.reviews.has(REVIEW_ID)).toBe(false);
    expect(tx.events).toEqual(["begin", "commit"]);
  });

  it("レビューの検索と削除を同じトランザクション内で、この順に行う", async () => {
    const { service, reviewRepository } = setup();

    await service.execute({ reviewId: REVIEW_ID });

    expect(reviewRepository.calls).toEqual([
      { method: "findById", inTransaction: true },
      { method: "delete", inTransaction: true },
    ]);
  });

  it("レビューIDが登録されていなければ削除せず REVIEW_NOT_FOUND を返す", async () => {
    const { service, reviewRepository, tx } = setup();
    const unknownId = ReviewId.generate().value;

    const result = await service.execute({ reviewId: unknownId });

    expect(result).toEqual({
      ok: false,
      error: { code: "REVIEW_NOT_FOUND", message: expect.stringContaining(unknownId) },
    });
    expect(reviewRepository.calls.map((call) => call.method)).toEqual(["findById"]);
    // 書き込み前の業務エラーなので、ロールバックではなくコミットで終える
    expect(tx.events).toEqual(["begin", "commit"]);
  });

  it.each(["", "invalid", REVIEW_ID.toLowerCase()])(
    "レビューIDが不正（'%s'）なら VALIDATION_ERROR を返し、トランザクションを開始しない",
    async (reviewId) => {
      const { service, tx, reviewRepository } = setup();

      const result = await service.execute({ reviewId });

      expect(!result.ok && result.error.code).toBe("VALIDATION_ERROR");
      expect(tx.events).toEqual([]);
      expect(reviewRepository.calls).toEqual([]);
    },
  );

  it.each(["findById", "delete"] as const)(
    "リポジトリの %s が失敗したら例外を伝播し、ロールバックする",
    async (method) => {
      const { service, reviewRepository, tx } = setup();
      reviewRepository.failOn = method;

      await expect(service.execute({ reviewId: REVIEW_ID })).rejects.toThrow(`review repository ${method} failed`);
      expect(tx.events).toEqual(["begin", "rollback"]);
    },
  );
});

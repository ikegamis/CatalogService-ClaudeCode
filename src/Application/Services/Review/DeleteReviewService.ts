import { IReviewRepository } from "Domain/Models/Review/IReviewRepository";
import { ReviewId } from "Domain/Models/Review/ReviewId";
import { ITransactionManager } from "Application/Shared/ITransactionManager";
import { failure, parseInput, success, UseCaseResult } from "Application/Shared/UseCaseResult";

export type DeleteReviewCommand = {
  reviewId: string;
};

export type DeleteReviewDto = {
  /** 削除したレビューのID。 */
  reviewId: string;
};

/** UC-CATALOG-003 レビューの削除。 */
export class DeleteReviewService {
  constructor(
    private readonly reviewRepository: IReviewRepository,
    private readonly transactionManager: ITransactionManager,
  ) {}

  async execute(command: DeleteReviewCommand): Promise<UseCaseResult<DeleteReviewDto>> {
    const parsed = parseInput(() => new ReviewId(command.reviewId));
    if (!parsed.ok) {
      return parsed;
    }
    const reviewId = parsed.data;

    return this.transactionManager.begin(async () => {
      const review = await this.reviewRepository.findById(reviewId);
      if (review === null) {
        return failure<DeleteReviewDto>("REVIEW_NOT_FOUND", `レビューID '${reviewId.value}' のレビューは登録されていません。`);
      }
      await this.reviewRepository.delete(review.reviewId);
      return success({ reviewId: review.reviewId.value });
    });
  }
}

import { BookId } from "Domain/Models/Book/BookId";
import { Comment } from "Domain/Models/Review/Comment";
import { IReviewRepository } from "Domain/Models/Review/IReviewRepository";
import { Name } from "Domain/Models/Review/Name";
import { Rating } from "Domain/Models/Review/Rating";
import { Review } from "Domain/Models/Review/Review";
import { ReviewId } from "Domain/Models/Review/ReviewId";
import { ITransactionManager } from "Application/Shared/ITransactionManager";
import { failure, parseInput, success, UseCaseResult } from "Application/Shared/UseCaseResult";

import { ReviewDto, toReviewDto } from "./ReviewDto";

export type UpdateReviewCommand = {
  reviewId: string;
  /** 更新後の書籍ID（ISBN）。書籍の存在は確認しない（UC-REVIEW-002 前提条件）。 */
  bookId: string;
  /** 投稿者名。null の場合は匿名投稿として既定値「名無し」を用いる。 */
  name: string | null;
  rating: number;
  /** レビューテキスト。null の場合はコメントなし。 */
  comment: string | null;
};

/**
 * UC-REVIEW-002 レビューの更新。
 * Rating と BookId を変更する振る舞いを Review が持たないため、
 * 仕様の基本フローどおり、既存レビューと同じ ReviewId で更新後の Review を構築して永続化する。
 */
export class UpdateReviewService {
  constructor(
    private readonly reviewRepository: IReviewRepository,
    private readonly transactionManager: ITransactionManager,
  ) {}

  async execute(command: UpdateReviewCommand): Promise<UseCaseResult<ReviewDto>> {
    const parsed = parseInput(() => ({
      reviewId: new ReviewId(command.reviewId),
      bookId: new BookId(command.bookId),
      name: Name.orAnonymous(command.name),
      rating: new Rating(command.rating),
      comment: command.comment === null ? null : new Comment(command.comment),
    }));
    if (!parsed.ok) {
      return parsed;
    }
    const input = parsed.data;

    return this.transactionManager.begin(async () => {
      const current = await this.reviewRepository.findById(input.reviewId);
      if (current === null) {
        return failure<ReviewDto>("REVIEW_NOT_FOUND", `レビューID '${input.reviewId.value}' のレビューは登録されていません。`);
      }
      const updated = new Review(current.reviewId, input.bookId, input.name, input.rating, input.comment);
      await this.reviewRepository.update(updated);
      return success(toReviewDto(updated));
    });
  }
}

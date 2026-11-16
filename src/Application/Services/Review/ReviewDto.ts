import { Review } from "Domain/Models/Review/Review";

/** レビューの出力 DTO。Domain の Review をそのまま外部へ公開しないためのプリミティブ表現。 */
export type ReviewDto = {
  reviewId: string;
  bookId: string;
  name: string;
  rating: number;
  /** コメントなしの場合は null。 */
  comment: string | null;
};

export const toReviewDto = (review: Review): ReviewDto => ({
  reviewId: review.reviewId.value,
  bookId: review.bookId.value,
  name: review.name.value,
  rating: review.rating.value,
  comment: review.comment === null ? null : review.comment.value,
});

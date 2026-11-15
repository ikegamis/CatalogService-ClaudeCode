import { BookId } from "Domain/Models/Book/BookId";

import { Review } from "./Review";
import { ReviewId } from "./ReviewId";

/** レビュー集約のリポジトリ抽象。 */
export interface IReviewRepository {
  /** レビューを永続化する。 */
  save(review: Review): Promise<void>;

  /** レビューを更新する。 */
  update(review: Review): Promise<void>;

  /** レビューを削除する。 */
  delete(reviewId: ReviewId): Promise<void>;

  /** レビューを検索する。発見できなければ null を返す。 */
  findById(reviewId: ReviewId): Promise<Review | null>;

  /** 特定の書籍に紐付いているレビューを検索する。 */
  findAllByBookId(bookId: BookId): Promise<Review[]>;
}

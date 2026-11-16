import { BookId } from "Domain/Models/Book/BookId";

import { Review } from "./Review";
import { ReviewId } from "./ReviewId";

/** レビュー集約のリポジトリ抽象。 */
export interface IReviewRepository {
  /** レビューを永続化する。 */
  save(review: Review): Promise<void>;

  /**
   * レビューを更新する（同時更新は後勝ち）。
   * 同じ ReviewId のレビューが永続化されていない場合（例：検索後に別セッションで削除された）は何もしない。
   * 新規に作成し直したり、例外を投げたりしない。
   */
  update(review: Review): Promise<void>;

  /** レビューを削除する。該当するレビューが永続化されていない場合は何もしない。 */
  delete(reviewId: ReviewId): Promise<void>;

  /** レビューを検索する。発見できなければ null を返す。 */
  findById(reviewId: ReviewId): Promise<Review | null>;

  /** 特定の書籍に紐付いているレビューを検索する。 */
  findAllByBookId(bookId: BookId): Promise<Review[]>;
}

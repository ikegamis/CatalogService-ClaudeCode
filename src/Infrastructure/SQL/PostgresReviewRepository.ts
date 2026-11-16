import { BookId } from "Domain/Models/Book/BookId";
import { Comment } from "Domain/Models/Review/Comment";
import { IReviewRepository } from "Domain/Models/Review/IReviewRepository";
import { Name } from "Domain/Models/Review/Name";
import { Rating } from "Domain/Models/Review/Rating";
import { Review } from "Domain/Models/Review/Review";
import { ReviewId } from "Domain/Models/Review/ReviewId";

import { PostgresDatabase } from "./PostgresDatabase";

type ReviewRow = {
  review_id: string;
  book_id: string;
  name: string;
  rating: number;
  comment: string | null;
};

const SELECT_COLUMNS = "review_id, book_id, name, rating, comment";

/**
 * レビュー集約リポジトリの PostgreSQL 実装。
 * 同時更新は後勝ち（transaction.md）。UPDATE の行ロックにより、後から更新したトランザクションは
 * 先のトランザクションの終了を待ってから上書きする。
 */
export class PostgresReviewRepository implements IReviewRepository {
  constructor(private readonly database: PostgresDatabase) {}

  /** レビューを INSERT する。同じ ReviewId が既にあれば主キー違反（技術エラー）になる。 */
  async save(review: Review): Promise<void> {
    await this.database.query(
      `INSERT INTO review (${SELECT_COLUMNS}) VALUES ($1, $2, $3, $4, $5)`,
      toParams(review),
    );
  }

  /** ReviewId 以外の属性を置き換える。該当行がなければ 0 行更新となり、何もしない（ポートの契約）。 */
  async update(review: Review): Promise<void> {
    await this.database.query(
      "UPDATE review SET book_id = $2, name = $3, rating = $4, comment = $5 WHERE review_id = $1",
      toParams(review),
    );
  }

  /** 該当行がなければ何もしない（ポートの契約）。 */
  async delete(reviewId: ReviewId): Promise<void> {
    await this.database.query("DELETE FROM review WHERE review_id = $1", [reviewId.value]);
  }

  async findById(reviewId: ReviewId): Promise<Review | null> {
    const result = await this.database.query<ReviewRow>(
      `SELECT ${SELECT_COLUMNS} FROM review WHERE review_id = $1`,
      [reviewId.value],
    );
    const row = result.rows[0];
    return row === undefined ? null : toReview(row);
  }

  /**
   * 書籍に紐づくレビューを review_id（ULID なので概ね投稿順）の昇順で返す。
   * 順序は仕様にないが、書籍推薦で品質係数が同じレビューの順序がこの順序に従うため、実行ごとに変わらないよう固定する。
   */
  async findAllByBookId(bookId: BookId): Promise<Review[]> {
    const result = await this.database.query<ReviewRow>(
      `SELECT ${SELECT_COLUMNS} FROM review WHERE book_id = $1 ORDER BY review_id`,
      [bookId.value],
    );
    return result.rows.map(toReview);
  }
}

const toParams = (review: Review): unknown[] => [
  review.reviewId.value,
  review.bookId.value,
  review.name.value,
  review.rating.value,
  review.comment?.value ?? null,
];

/** 行から集約を再構成する。値オブジェクトの生成時に検証されるため、DB に不正な値があれば例外になる。 */
const toReview = (row: ReviewRow): Review =>
  new Review(
    new ReviewId(row.review_id),
    new BookId(row.book_id),
    new Name(row.name),
    new Rating(row.rating),
    row.comment === null ? null : new Comment(row.comment),
  );

import { BookId } from "Domain/Models/Book/BookId";
import { Comment } from "Domain/Models/Review/Comment";
import { IReviewRepository } from "Domain/Models/Review/IReviewRepository";
import { Name } from "Domain/Models/Review/Name";
import { Rating } from "Domain/Models/Review/Rating";
import { Review } from "Domain/Models/Review/Review";
import { ReviewId } from "Domain/Models/Review/ReviewId";

import { InMemoryDatabase, ReviewRecord } from "./InMemoryDatabase";

/** レビュー集約リポジトリのインメモリ実装（テスト・ローカル用途）。 */
export class InMemoryReviewRepository implements IReviewRepository {
  constructor(private readonly database: InMemoryDatabase) {}

  /** 同じ ReviewId が既にあれば例外を投げる（SQL 実装の主キー違反に相当。上書きしない）。 */
  async save(review: Review): Promise<void> {
    await this.database.write((tables) => {
      if (tables.review.has(review.reviewId.value)) {
        throw new Error(`ReviewId '${review.reviewId.value}' のレビューは既に永続化されています。`);
      }
      tables.review.set(review.reviewId.value, toRecord(review));
    });
  }

  /** 該当するレビューがなければ何もしない（ポートの契約）。 */
  async update(review: Review): Promise<void> {
    await this.database.write((tables) => {
      if (tables.review.has(review.reviewId.value)) {
        tables.review.set(review.reviewId.value, toRecord(review));
      }
    });
  }

  /** 該当するレビューがなければ何もしない（ポートの契約）。 */
  async delete(reviewId: ReviewId): Promise<void> {
    await this.database.write((tables) => {
      tables.review.delete(reviewId.value);
    });
  }

  async findById(reviewId: ReviewId): Promise<Review | null> {
    const record = this.database.read((tables) => tables.review.get(reviewId.value));
    return record === undefined ? null : toReview(record);
  }

  /** SQL 実装と同じく review_id の昇順で返す。 */
  async findAllByBookId(bookId: BookId): Promise<Review[]> {
    const records = this.database.read((tables) =>
      Array.from(tables.review.values()).filter((record) => record.bookId === bookId.value),
    );
    return records
      .sort((a, b) => (a.reviewId < b.reviewId ? -1 : a.reviewId > b.reviewId ? 1 : 0))
      .map(toReview);
  }
}

const toRecord = (review: Review): ReviewRecord =>
  Object.freeze({
    reviewId: review.reviewId.value,
    bookId: review.bookId.value,
    name: review.name.value,
    rating: review.rating.value,
    comment: review.comment?.value ?? null,
  });

const toReview = (record: ReviewRecord): Review =>
  new Review(
    new ReviewId(record.reviewId),
    new BookId(record.bookId),
    new Name(record.name),
    new Rating(record.rating),
    record.comment === null ? null : new Comment(record.comment),
  );

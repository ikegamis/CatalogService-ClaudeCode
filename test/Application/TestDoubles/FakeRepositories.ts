import { Book } from "Domain/Models/Book/Book";
import { BookAlreadyExistsError } from "Domain/Models/Book/BookAlreadyExistsError";
import { BookId } from "Domain/Models/Book/BookId";
import { IBookRepository } from "Domain/Models/Book/IBookRepository";
import { IReviewRepository } from "Domain/Models/Review/IReviewRepository";
import { Review } from "Domain/Models/Review/Review";
import { ReviewId } from "Domain/Models/Review/ReviewId";

import { FakeTransactionManager } from "./FakeTransactionManager";

/** 呼び出しがトランザクション内で行われたかを記録する。 */
type CallLog = { method: string; inTransaction: boolean };

/** 書籍リポジトリのテストダブル。failOn に指定したメソッドは技術的障害として例外を投げる。 */
export class FakeBookRepository implements IBookRepository {
  readonly calls: CallLog[] = [];
  readonly books = new Map<string, Book>();
  failOn: keyof IBookRepository | null = null;

  constructor(
    private readonly tx: FakeTransactionManager | null = null,
    initial: Book[] = [],
  ) {
    initial.forEach((book) => this.books.set(book.bookId.value, book));
  }

  /** ポートの契約どおり、同じ書籍IDが既にあれば上書きせず BookAlreadyExistsError を投げる。 */
  async save(book: Book): Promise<void> {
    this.record("save");
    if (this.books.has(book.bookId.value)) {
      throw new BookAlreadyExistsError(book.bookId);
    }
    this.books.set(book.bookId.value, book);
  }

  async findById(bookId: BookId): Promise<Book | null> {
    this.record("findById");
    return this.books.get(bookId.value) ?? null;
  }

  private record(method: keyof IBookRepository): void {
    this.calls.push({ method, inTransaction: this.tx?.inTransaction ?? false });
    if (this.failOn === method) {
      throw new Error(`book repository ${method} failed`);
    }
  }
}

/** レビューリポジトリのテストダブル。failOn に指定したメソッドは技術的障害として例外を投げる。 */
export class FakeReviewRepository implements IReviewRepository {
  readonly calls: CallLog[] = [];
  readonly reviews = new Map<string, Review>();
  failOn: keyof IReviewRepository | null = null;

  constructor(
    private readonly tx: FakeTransactionManager | null = null,
    initial: Review[] = [],
  ) {
    initial.forEach((review) => this.reviews.set(review.reviewId.value, review));
  }

  async save(review: Review): Promise<void> {
    this.record("save");
    this.reviews.set(review.reviewId.value, review);
  }

  async update(review: Review): Promise<void> {
    this.record("update");
    this.reviews.set(review.reviewId.value, review);
  }

  async delete(reviewId: ReviewId): Promise<void> {
    this.record("delete");
    this.reviews.delete(reviewId.value);
  }

  async findById(reviewId: ReviewId): Promise<Review | null> {
    this.record("findById");
    return this.reviews.get(reviewId.value) ?? null;
  }

  async findAllByBookId(bookId: BookId): Promise<Review[]> {
    this.record("findAllByBookId");
    return Array.from(this.reviews.values()).filter((review) => review.bookId.equals(bookId));
  }

  private record(method: keyof IReviewRepository): void {
    this.calls.push({ method, inTransaction: this.tx?.inTransaction ?? false });
    if (this.failOn === method) {
      throw new Error(`review repository ${method} failed`);
    }
  }
}

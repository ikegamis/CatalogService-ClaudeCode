import { Author } from "Domain/Models/Book/Author";
import { Book } from "Domain/Models/Book/Book";
import { BookId } from "Domain/Models/Book/BookId";
import { Price } from "Domain/Models/Book/Price";
import { Title } from "Domain/Models/Book/Title";
import { Comment } from "Domain/Models/Review/Comment";
import { Name } from "Domain/Models/Review/Name";
import { Rating } from "Domain/Models/Review/Rating";
import { Review } from "Domain/Models/Review/Review";
import { ReviewId } from "Domain/Models/Review/ReviewId";

export const BOOK_ID_1 = "9784000000001";
export const BOOK_ID_2 = "9784000000002";

export const makeBook = (
  overrides: Partial<{ bookId: string; title: string; author: string; price: number }> = {},
): Book =>
  new Book(
    new BookId(overrides.bookId ?? BOOK_ID_1),
    new Title(overrides.title ?? "ドメイン駆動設計入門"),
    new Author(overrides.author ?? "山田太郎"),
    new Price(overrides.price ?? 3200),
  );

/** 末尾の番号だけが異なる、比較順の予測できる ULID を作る。 */
export const reviewIdOf = (n: number): string => `01JD${String(n).padStart(22, "0")}`;

export const makeReview = (
  overrides: Partial<{ reviewId: string; bookId: string; name: string; rating: number; comment: string | null }> = {},
): Review =>
  new Review(
    new ReviewId(overrides.reviewId ?? reviewIdOf(1)),
    new BookId(overrides.bookId ?? BOOK_ID_1),
    new Name(overrides.name ?? "読書家A"),
    new Rating(overrides.rating ?? 5),
    overrides.comment === null ? null : new Comment(overrides.comment ?? "『オブジェクト指向入門』を読むと理解が深まります。"),
  );

/** 永続化の比較用に集約をプリミティブへ展開する。 */
export const bookValues = (book: Book | null) =>
  book && {
    bookId: book.bookId.value,
    title: book.title.value,
    author: book.author.value,
    price: book.price.value,
  };

export const reviewValues = (review: Review | null) =>
  review && {
    reviewId: review.reviewId.value,
    bookId: review.bookId.value,
    name: review.name.value,
    rating: review.rating.value,
    comment: review.comment?.value ?? null,
  };

export type Deferred<T = void> = { promise: Promise<T>; resolve: (value: T) => void };

export const deferred = <T = void>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

export const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

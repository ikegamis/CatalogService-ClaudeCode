import { BookDto } from "Application/Services/Book/BookDto";
import { ReviewDto } from "Application/Services/Review/ReviewDto";
import { UseCaseResult } from "Application/Shared/UseCaseResult";
import { UseCaseFailedError } from "Presentation/Express/Errors/HttpErrors";

/** openapi.yml の components/schemas/Book。 */
export type BookResponse = {
  isbn: string;
  title: string;
  author: string;
  price: number;
};

/** openapi.yml の components/schemas/Review。 */
export type ReviewResponse = {
  id: string;
  bookId: string;
  name: string;
  rating: number;
  comment: string | null;
};

export const toBookResponse = (dto: BookDto): BookResponse => ({
  isbn: dto.bookId,
  title: dto.title,
  author: dto.author,
  price: dto.price,
});

export const toReviewResponse = (dto: ReviewDto): ReviewResponse => ({
  id: dto.reviewId,
  bookId: dto.bookId,
  name: dto.name,
  rating: dto.rating,
  comment: dto.comment,
});

/** 成功ならデータを返し、失敗ならエラー処理ミドルウェアで FalseMessage に変換させる。 */
export const unwrap = <T>(result: UseCaseResult<T>): T => {
  if (!result.ok) {
    throw new UseCaseFailedError(result.error);
  }
  return result.data;
};

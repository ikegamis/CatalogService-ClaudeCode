import { BookId } from "Domain/Models/Book/BookId";
import { IBookRepository } from "Domain/Models/Book/IBookRepository";
import { Comment } from "Domain/Models/Review/Comment";
import { IReviewRepository } from "Domain/Models/Review/IReviewRepository";
import { Name } from "Domain/Models/Review/Name";
import { Rating } from "Domain/Models/Review/Rating";
import { Review } from "Domain/Models/Review/Review";
import { ITransactionManager } from "Application/Shared/ITransactionManager";
import { failure, parseInput, success, UseCaseResult } from "Application/Shared/UseCaseResult";

import { ReviewDto, toReviewDto } from "./ReviewDto";

export type RegisterReviewCommand = {
  /** レビュー対象の書籍ID（ISBN）。 */
  bookId: string;
  /** 投稿者名。省略または null の場合は匿名投稿として既定値「名無し」を用いる。 */
  name?: string | null;
  rating: number;
  /** レビューテキスト。省略または null の場合はコメントなし。 */
  comment?: string | null;
};

/** UC-REVIEW-001 レビューの登録。 */
export class RegisterReviewService {
  constructor(
    private readonly bookRepository: IBookRepository,
    private readonly reviewRepository: IReviewRepository,
    private readonly transactionManager: ITransactionManager,
  ) {}

  async execute(command: RegisterReviewCommand): Promise<UseCaseResult<ReviewDto>> {
    const parsed = parseInput(() =>
      Review.create(
        new BookId(command.bookId),
        Name.orAnonymous(command.name ?? null),
        new Rating(command.rating),
        command.comment == null ? null : new Comment(command.comment),
      ),
    );
    if (!parsed.ok) {
      return parsed;
    }
    const review = parsed.data;

    return this.transactionManager.begin(async () => {
      if ((await this.bookRepository.findById(review.bookId)) === null) {
        return failure<ReviewDto>("BOOK_NOT_FOUND", `書籍ID '${review.bookId.value}' の書籍は登録されていません。`);
      }
      await this.reviewRepository.save(review);
      return success(toReviewDto(review));
    });
  }
}

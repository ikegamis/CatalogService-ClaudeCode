import { Author } from "Domain/Models/Book/Author";
import { Book } from "Domain/Models/Book/Book";
import { BookAlreadyExistsError } from "Domain/Models/Book/BookAlreadyExistsError";
import { BookId } from "Domain/Models/Book/BookId";
import { IBookRepository } from "Domain/Models/Book/IBookRepository";
import { Price } from "Domain/Models/Book/Price";
import { Title } from "Domain/Models/Book/Title";
import { ITransactionManager } from "Application/Shared/ITransactionManager";
import { failure, parseInput, success, UseCaseResult } from "Application/Shared/UseCaseResult";

import { BookDto, toBookDto } from "./BookDto";

export type RegisterBookCommand = {
  /** 書籍ID（ISBN）。 */
  bookId: string;
  title: string;
  author: string;
  price: number;
};

/** UC-BOOK-001 書籍登録。 */
export class RegisterBookService {
  constructor(
    private readonly bookRepository: IBookRepository,
    private readonly transactionManager: ITransactionManager,
  ) {}

  async execute(command: RegisterBookCommand): Promise<UseCaseResult<BookDto>> {
    const parsed = parseInput(
      () =>
        new Book(
          new BookId(command.bookId),
          new Title(command.title),
          new Author(command.author),
          new Price(command.price),
        ),
    );
    if (!parsed.ok) {
      return parsed;
    }
    const book = parsed.data;

    try {
      return await this.transactionManager.begin(async () => {
        if ((await this.bookRepository.findById(book.bookId)) !== null) {
          return alreadyExists(book.bookId);
        }
        await this.bookRepository.save(book);
        return success(toBookDto(book));
      });
    } catch (error) {
      // 存在確認だけでは同時登録を防げない（未登録行はロックされない）。
      // 確認後に同じ書籍IDが登録された場合は save が BookAlreadyExistsError を投げるので、
      // ロールバック後に業務上の重複として扱う。
      if (error instanceof BookAlreadyExistsError) {
        return alreadyExists(error.bookId);
      }
      throw error;
    }
  }
}

const alreadyExists = (bookId: BookId): UseCaseResult<BookDto> =>
  failure("BOOK_ALREADY_EXISTS", `書籍ID '${bookId.value}' は既に登録されています。`);

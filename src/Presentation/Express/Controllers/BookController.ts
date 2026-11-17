import { Request, Response } from "express";

import { BookDto } from "Application/Services/Book/BookDto";
import { RecommendBooksDto, RecommendBooksQuery } from "Application/Services/Book/RecommendBooksService";
import { RegisterBookCommand } from "Application/Services/Book/RegisterBookService";
import { toBookResponse, unwrap } from "Presentation/Express/Mappers/ResponseMapper";
import {
  optionalNumberQuery,
  requireJsonObject,
  requireNumber,
  requireString,
} from "Presentation/Express/Validation/RequestValidator";

import { UseCase } from "./UseCase";

export class BookController {
  constructor(
    private readonly registerBook: UseCase<RegisterBookCommand, BookDto>,
    private readonly recommendBooks: UseCase<RecommendBooksQuery, RecommendBooksDto>,
  ) {}

  /** POST /book（UC-BOOK-001 書籍登録）。 */
  readonly create = async (req: Request, res: Response): Promise<void> => {
    const body = requireJsonObject(req.body);
    const command: RegisterBookCommand = {
      bookId: requireString(body, "isbn"),
      title: requireString(body, "title"),
      author: requireString(body, "author"),
      price: requireNumber(body, "price"),
    };
    const book = unwrap(await this.registerBook.execute(command));
    res.status(201).json({ ok: true, book: toBookResponse(book) });
  };

  /** GET /book/{isbn}/recommendations（UC-CATALOG-001 書籍推薦）。 */
  readonly getRecommendations = async (req: Request<{ isbn: string }>, res: Response): Promise<void> => {
    const query: RecommendBooksQuery = {
      bookId: req.params.isbn,
      threshold: optionalNumberQuery(req.query.threshold, "threshold"),
    };
    const result = unwrap(await this.recommendBooks.execute(query));
    res.status(200).json({ ok: true, recommendedBooks: result.recommendedBooks });
  };
}

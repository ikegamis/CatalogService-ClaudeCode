import { DatabaseError } from "pg";

import { Author } from "Domain/Models/Book/Author";
import { Book } from "Domain/Models/Book/Book";
import { BookAlreadyExistsError } from "Domain/Models/Book/BookAlreadyExistsError";
import { BookId } from "Domain/Models/Book/BookId";
import { IBookRepository } from "Domain/Models/Book/IBookRepository";
import { Price } from "Domain/Models/Book/Price";
import { Title } from "Domain/Models/Book/Title";

import { PostgresDatabase } from "./PostgresDatabase";

type BookRow = {
  book_id: string;
  title: string;
  author: string;
  price: number;
};

/** PostgreSQL の一意制約違反のエラーコード。 */
const UNIQUE_VIOLATION = "23505";
const BOOK_PRIMARY_KEY = "book_pkey";

/** 書籍集約リポジトリの PostgreSQL 実装。 */
export class PostgresBookRepository implements IBookRepository {
  constructor(private readonly database: PostgresDatabase) {}

  /**
   * 書籍を INSERT する。上書きはしない。
   * 存在確認から保存までの間に同じ書籍IDが登録された場合（同時登録）は、主キー違反を BookAlreadyExistsError に変換する。
   * トランザクション内でこのエラーが起きると、そのトランザクションは以降の SQL を受け付けなくなる。
   * callback 内で catch して正常終了しても、トランザクション管理が TransactionAbortedError を投げる。
   */
  async save(book: Book): Promise<void> {
    try {
      await this.database.query(
        "INSERT INTO book (book_id, title, author, price) VALUES ($1, $2, $3, $4)",
        [book.bookId.value, book.title.value, book.author.value, book.price.value],
      );
    } catch (error) {
      if (error instanceof DatabaseError && error.code === UNIQUE_VIOLATION && error.constraint === BOOK_PRIMARY_KEY) {
        throw new BookAlreadyExistsError(book.bookId);
      }
      throw error;
    }
  }

  async findById(bookId: BookId): Promise<Book | null> {
    const result = await this.database.query<BookRow>(
      "SELECT book_id, title, author, price FROM book WHERE book_id = $1",
      [bookId.value],
    );
    const row = result.rows[0];
    return row === undefined ? null : toBook(row);
  }
}

/** 行から集約を再構成する。値オブジェクトの生成時に検証されるため、DB に不正な値があれば例外になる。 */
const toBook = (row: BookRow): Book =>
  new Book(new BookId(row.book_id), new Title(row.title), new Author(row.author), new Price(row.price));

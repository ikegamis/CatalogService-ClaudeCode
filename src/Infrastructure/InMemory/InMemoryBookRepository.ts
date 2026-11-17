import { Author } from "Domain/Models/Book/Author";
import { Book } from "Domain/Models/Book/Book";
import { BookAlreadyExistsError } from "Domain/Models/Book/BookAlreadyExistsError";
import { BookId } from "Domain/Models/Book/BookId";
import { IBookRepository } from "Domain/Models/Book/IBookRepository";
import { Price } from "Domain/Models/Book/Price";
import { Title } from "Domain/Models/Book/Title";

import { BookRecord, InMemoryDatabase } from "./InMemoryDatabase";

/** 書籍集約リポジトリのインメモリ実装（テスト・ローカル用途）。 */
export class InMemoryBookRepository implements IBookRepository {
  constructor(private readonly database: InMemoryDatabase) {}

  /** 同じ書籍IDが既にあれば上書きせず BookAlreadyExistsError を投げる（SQL 実装の主キー違反に相当）。 */
  async save(book: Book): Promise<void> {
    await this.database.write((tables) => {
      if (tables.book.has(book.bookId.value)) {
        throw new BookAlreadyExistsError(book.bookId);
      }
      tables.book.set(book.bookId.value, toRecord(book));
    });
  }

  async findById(bookId: BookId): Promise<Book | null> {
    const record = this.database.read((tables) => tables.book.get(bookId.value));
    return record === undefined ? null : toBook(record);
  }
}

const toRecord = (book: Book): BookRecord =>
  Object.freeze({
    bookId: book.bookId.value,
    title: book.title.value,
    author: book.author.value,
    price: book.price.value,
  });

const toBook = (record: BookRecord): Book =>
  new Book(new BookId(record.bookId), new Title(record.title), new Author(record.author), new Price(record.price));

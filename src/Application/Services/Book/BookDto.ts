import { Book } from "Domain/Models/Book/Book";

/** 書籍の出力 DTO。Domain の Book をそのまま外部へ公開しないためのプリミティブ表現。 */
export type BookDto = {
  bookId: string;
  title: string;
  author: string;
  /** 価格（日本円・整数円）。 */
  price: number;
};

export const toBookDto = (book: Book): BookDto => ({
  bookId: book.bookId.value,
  title: book.title.value,
  author: book.author.value,
  price: book.price.value,
});

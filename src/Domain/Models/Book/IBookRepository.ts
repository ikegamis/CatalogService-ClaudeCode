import { Book } from "./Book";
import { BookId } from "./BookId";

/**
 * 書籍集約のリポジトリ抽象。
 * 仕様上「書籍集約は一度生成したら削除できない」ため、削除操作は定義しない。
 */
export interface IBookRepository {
  /**
   * 書籍オブジェクトを永続化する。
   * 同じ書籍IDの書籍が既に永続化されている場合は BookAlreadyExistsError（./BookAlreadyExistsError）を投げる（上書きしない）。
   */
  save(book: Book): Promise<void>;

  /** 書籍を検索する。発見できなければ null を返す。 */
  findById(bookId: BookId): Promise<Book | null>;
}

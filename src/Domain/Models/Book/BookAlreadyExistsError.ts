import { BookId } from "./BookId";

/**
 * 既に登録されている書籍IDの書籍を永続化しようとしたことを表すエラー。
 * 存在確認と保存の間に同じ書籍IDの登録が割り込んだ場合（同時登録）でも、
 * リポジトリ実装がこのエラーを投げることで、技術的障害ではなく業務上の重複として扱えるようにする。
 */
export class BookAlreadyExistsError extends Error {
  constructor(readonly bookId: BookId) {
    super(`書籍ID '${bookId.value}' は既に登録されています。`);
    this.name = "BookAlreadyExistsError";
  }
}

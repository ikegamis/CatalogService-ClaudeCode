/**
 * ドメインの制約（値オブジェクトの値域、引数の値域など）に違反したことを表すエラー。
 * 外側の層が入力起因のエラーと技術的なエラーを型で区別できるよう、素の Error とは別の型にする。
 */
export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainValidationError";
  }
}

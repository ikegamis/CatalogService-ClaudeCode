import { ValueObject } from "Domain/Shared/ValueObject";

type BookIdValue = string;

/**
 * 書籍識別子（ISBNコード）。
 * 仕様上、ISBN の桁構成・チェックディジット検証はサンプルのためオミットし、
 * 「13文字の文字列長」のみを制約とする（doc/domain/models/Book/Book.md「BookId の制約」）。
 */
export class BookId extends ValueObject<BookIdValue, "BookId"> {
  static readonly LENGTH = 13;

  constructor(value: BookIdValue) {
    super(value);
  }

  protected validate(value: BookIdValue): void {
    if (value.length !== BookId.LENGTH) {
      throw new Error(`BookIdは${BookId.LENGTH}文字である必要があります。`);
    }
  }
}

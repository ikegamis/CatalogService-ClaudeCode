import { DomainValidationError } from "Domain/Shared/DomainValidationError";
import { ValueObject } from "Domain/Shared/ValueObject";

type AuthorValue = string;

/** 著者。文字数は string.length で数える。 */
export class Author extends ValueObject<AuthorValue, "Author"> {
  static readonly MIN_LENGTH = 1;
  static readonly MAX_LENGTH = 100;

  constructor(value: AuthorValue) {
    super(value);
  }

  protected validate(value: AuthorValue): void {
    if (value.length < Author.MIN_LENGTH || value.length > Author.MAX_LENGTH) {
      throw new DomainValidationError(
        `Authorは${Author.MIN_LENGTH}文字以上${Author.MAX_LENGTH}文字以下である必要があります。`,
      );
    }
  }
}

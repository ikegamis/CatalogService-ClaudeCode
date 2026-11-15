import { ValueObject } from "Domain/Shared/ValueObject";

type TitleValue = string;

/** 書籍タイトル。文字数は string.length で数える。 */
export class Title extends ValueObject<TitleValue, "Title"> {
  static readonly MIN_LENGTH = 1;
  static readonly MAX_LENGTH = 1000;

  constructor(value: TitleValue) {
    super(value);
  }

  protected validate(value: TitleValue): void {
    if (value.length < Title.MIN_LENGTH || value.length > Title.MAX_LENGTH) {
      throw new Error(
        `Titleは${Title.MIN_LENGTH}文字以上${Title.MAX_LENGTH}文字以下である必要があります。`,
      );
    }
  }
}

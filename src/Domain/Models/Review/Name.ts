import { ValueObject } from "Domain/Shared/ValueObject";

type NameValue = string;

/**
 * 投稿者名。前後空白を trim した後の文字列を値とし、その string.length で文字数を検証する。
 * ID 管理を行わないため、Name が同じなら同じ投稿者とみなす。匿名投稿は Review 側で Name を null とする。
 */
export class Name extends ValueObject<NameValue, "Name"> {
  static readonly MIN_LENGTH = 1;
  static readonly MAX_LENGTH = 50;

  constructor(value: NameValue) {
    super(value.trim());
  }

  protected validate(value: NameValue): void {
    if (value.length < Name.MIN_LENGTH || value.length > Name.MAX_LENGTH) {
      throw new Error(
        `Nameは${Name.MIN_LENGTH}文字以上${Name.MAX_LENGTH}文字以下である必要があります。`,
      );
    }
  }
}

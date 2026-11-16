import { DomainValidationError } from "Domain/Shared/DomainValidationError";
import { ValueObject } from "Domain/Shared/ValueObject";

type NameValue = string;

/**
 * 投稿者名。前後空白を trim した後の文字列を値とし、その string.length で文字数を検証する。
 * ID 管理を行わないため、Name が同じなら同じ投稿者とみなす。
 * 匿名投稿では既定値「名無し」を用いるため、匿名投稿はすべて同一投稿者として扱われる。
 */
export class Name extends ValueObject<NameValue, "Name"> {
  static readonly MIN_LENGTH = 1;
  static readonly MAX_LENGTH = 50;
  /** 投稿者名が省略された場合（匿名投稿）の既定値。 */
  static readonly ANONYMOUS_VALUE = "名無し";

  constructor(value: NameValue) {
    super(value.trim());
  }

  /** 匿名投稿用の投稿者名（既定値「名無し」）を返す。 */
  static anonymous(): Name {
    return new Name(Name.ANONYMOUS_VALUE);
  }

  protected validate(value: NameValue): void {
    if (value.length < Name.MIN_LENGTH || value.length > Name.MAX_LENGTH) {
      throw new DomainValidationError(
        `Nameは${Name.MIN_LENGTH}文字以上${Name.MAX_LENGTH}文字以下である必要があります。`,
      );
    }
  }
}

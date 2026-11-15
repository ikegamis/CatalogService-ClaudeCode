import { ValueObject } from "Domain/Shared/ValueObject";

type CommentValue = string;

/** レビューコメント。文字数は string.length で数える。不適切コメントの判定は行わない。 */
export class Comment extends ValueObject<CommentValue, "Comment"> {
  static readonly MIN_LENGTH = 1;
  static readonly MAX_LENGTH = 1000;

  /** 品質係数が線形に増加する区間の下端（この文字数未満は最低品質）。 */
  private static readonly QUALITY_LOWER_LENGTH = 10;
  /** 品質係数が最大となる文字数。 */
  private static readonly QUALITY_UPPER_LENGTH = 100;
  private static readonly MIN_QUALITY = 0.2;
  private static readonly MAX_QUALITY = 1.0;

  constructor(value: CommentValue) {
    super(value);
  }

  /** コメント長に基づく 0.2〜1.0 の品質係数を返す。 */
  getQualityFactor(): number {
    const length = this._value.length;
    if (length < Comment.QUALITY_LOWER_LENGTH) {
      return Comment.MIN_QUALITY;
    }
    if (length >= Comment.QUALITY_UPPER_LENGTH) {
      return Comment.MAX_QUALITY;
    }
    return (
      Comment.MIN_QUALITY +
      ((length - Comment.QUALITY_LOWER_LENGTH) /
        (Comment.QUALITY_UPPER_LENGTH - Comment.QUALITY_LOWER_LENGTH)) *
        (Comment.MAX_QUALITY - Comment.MIN_QUALITY)
    );
  }

  /** 正規表現に一致する部分文字列（一致全体）をすべて返す。グローバルフラグがなければ付与する。 */
  extractMatches(pattern: RegExp): string[] {
    const globalPattern = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
    return this._value.match(globalPattern) ?? [];
  }

  protected validate(value: CommentValue): void {
    if (value.length < Comment.MIN_LENGTH || value.length > Comment.MAX_LENGTH) {
      throw new Error(
        `Commentは${Comment.MIN_LENGTH}文字以上${Comment.MAX_LENGTH}文字以下である必要があります。`,
      );
    }
  }
}

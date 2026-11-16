import { DomainValidationError } from "Domain/Shared/DomainValidationError";
import { ValueObject } from "Domain/Shared/ValueObject";

type RatingValue = number;

/** 評価（星）。1〜5 の整数で、5 が最も良い評価。 */
export class Rating extends ValueObject<RatingValue, "Rating"> {
  static readonly MIN = 1;
  static readonly MAX = 5;

  constructor(value: RatingValue) {
    super(value);
  }

  /** 評価値を 0.0〜1.0 に正規化した品質係数を返す。 */
  getQualityFactor(): number {
    return (this._value - Rating.MIN) / (Rating.MAX - Rating.MIN);
  }

  protected validate(value: RatingValue): void {
    // Number.isInteger は NaN / Infinity も拒否する
    if (!Number.isInteger(value) || value < Rating.MIN || value > Rating.MAX) {
      throw new DomainValidationError(`Ratingは${Rating.MIN}以上${Rating.MAX}以下の整数である必要があります。`);
    }
  }
}

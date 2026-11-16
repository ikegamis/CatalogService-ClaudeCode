import { DomainValidationError } from "Domain/Shared/DomainValidationError";
import { ValueObject } from "Domain/Shared/ValueObject";

type ThresholdValue = number;

/** レビューの信頼性を判定する閾値。0 以上 1.0 以下。 */
export class Threshold extends ValueObject<ThresholdValue, "Threshold"> {
  static readonly MIN = 0;
  static readonly MAX = 1.0;
  static readonly DEFAULT_VALUE = 0.6;

  constructor(value: ThresholdValue) {
    super(value);
  }

  /** 既定の閾値（0.6）を返す。 */
  static default(): Threshold {
    return new Threshold(Threshold.DEFAULT_VALUE);
  }

  protected validate(value: ThresholdValue): void {
    // 数値でない値は拒否する（Review.md「Threshold の制約」）。型注釈は実行時に効かず、"0.5" のような文字列は比較で暗黙に数値化されて通ってしまうため。
    // 比較の否定で判定するため NaN も拒否される
    if (typeof value !== "number" || !(value >= Threshold.MIN && value <= Threshold.MAX)) {
      throw new DomainValidationError(
        `Thresholdは${Threshold.MIN}以上${Threshold.MAX}以下である必要があります。`,
      );
    }
  }
}

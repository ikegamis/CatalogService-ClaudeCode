import { DomainValidationError } from "Domain/Shared/DomainValidationError";
import { ValueObject } from "Domain/Shared/ValueObject";

type PriceValue = number;

/**
 * 価格。通貨は日本円（JPY）のみを扱い、整数円に限定する。
 * 円未満が存在しないため、value は「円」単位の整数そのものを表す。
 */
export class Price extends ValueObject<PriceValue, "Price"> {
  static readonly MIN = 1;
  static readonly MAX = 1_000_000;

  constructor(value: PriceValue) {
    super(value);
  }

  protected validate(value: PriceValue): void {
    // Number.isInteger は NaN / Infinity も拒否する
    if (!Number.isInteger(value)) {
      throw new DomainValidationError("Priceは整数円である必要があります。");
    }
    if (value < Price.MIN || value > Price.MAX) {
      throw new DomainValidationError(
        `Priceは${Price.MIN}円以上${Price.MAX}円以下である必要があります。`,
      );
    }
  }
}

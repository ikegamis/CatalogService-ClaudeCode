import isEqual from "lodash/isEqual";

export abstract class ValueObject<T, U> {
  // @ts-expect-error
  private _type: U;
  protected readonly _value: T;

  constructor(value: T) {
    this.validate(value);
    this._value = value;
  }

  protected abstract validate(value: T): void;

  get value(): T {
    return this._value;
  }

  equals(other: ValueObject<T, U>): boolean {
    return isEqual(this._value, other._value);
  }
}

/**
 * 宣言例
 * type RatingValue = number; // 値オブジェクトの持つプリミティブ型
 * export class Rating extends ValueObject<RagingValue, "Rating"> { // U はクラス名を文字列で書くこと
 *   constructor(value: RatingValue) {
 *     super(value);
 *   }
 * 
*/

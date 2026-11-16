import isEqual from "lodash/isEqual";

export abstract class ValueObject<T, U> {
  /** 型 U は異なる値オブジェクト同士の取り違えを型レベルで防ぐための名義的マーカー。実行時には存在しない。 */
  declare private readonly _type: U;
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

import { Price } from "Domain/Models/Book/Price";

describe("Price", () => {
  describe("生成", () => {
    it("1円の価格を生成できる（下限）", () => {
      expect(new Price(1).value).toBe(1);
    });

    it("1,000,000円の価格を生成できる（上限）", () => {
      expect(new Price(1_000_000).value).toBe(1_000_000);
    });

    it("0円の価格は生成できない", () => {
      expect(() => new Price(0)).toThrow();
    });

    it("負の価格は生成できない", () => {
      expect(() => new Price(-1)).toThrow();
    });

    it("1,000,001円の価格は生成できない", () => {
      expect(() => new Price(1_000_001)).toThrow();
    });

    it("小数を含む価格は生成できない（整数円に限定）", () => {
      expect(() => new Price(100.5)).toThrow();
    });

    it("NaNは価格として生成できない", () => {
      expect(() => new Price(Number.NaN)).toThrow();
    });

    it("Infinityは価格として生成できない", () => {
      expect(() => new Price(Number.POSITIVE_INFINITY)).toThrow();
    });
  });

  describe("等価性", () => {
    it("同じ金額の価格は等しい", () => {
      expect(new Price(1000).equals(new Price(1000))).toBe(true);
    });

    it("異なる金額の価格は等しくない", () => {
      expect(new Price(1000).equals(new Price(2000))).toBe(false);
    });
  });
});

import { Rating } from "Domain/Models/Review/Rating";

describe("Rating", () => {
  describe("生成", () => {
    it.each([1, 2, 3, 4, 5])("評価 %i を生成できる", (value) => {
      expect(new Rating(value).value).toBe(value);
    });

    it("評価0は生成できない", () => {
      expect(() => new Rating(0)).toThrow();
    });

    it("評価6は生成できない", () => {
      expect(() => new Rating(6)).toThrow();
    });

    it("負の評価は生成できない", () => {
      expect(() => new Rating(-1)).toThrow();
    });

    it("小数の評価は生成できない（整数に限定）", () => {
      expect(() => new Rating(3.5)).toThrow();
    });

    it("NaNは評価として生成できない", () => {
      expect(() => new Rating(Number.NaN)).toThrow();
    });

    it("Infinityは評価として生成できない", () => {
      expect(() => new Rating(Number.POSITIVE_INFINITY)).toThrow();
    });
  });

  describe("品質係数", () => {
    it.each([
      [1, 0.0],
      [2, 0.25],
      [3, 0.5],
      [4, 0.75],
      [5, 1.0],
    ])("評価 %i の品質係数は %f", (value, expected) => {
      expect(new Rating(value).getQualityFactor()).toBeCloseTo(expected);
    });
  });

  describe("等価性", () => {
    it("同じ評価は等しい", () => {
      expect(new Rating(3).equals(new Rating(3))).toBe(true);
    });

    it("異なる評価は等しくない", () => {
      expect(new Rating(3).equals(new Rating(4))).toBe(false);
    });
  });
});

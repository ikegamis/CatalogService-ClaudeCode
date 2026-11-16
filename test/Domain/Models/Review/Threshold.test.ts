import { Threshold } from "Domain/Models/Review/Threshold";
import { DomainValidationError } from "Domain/Shared/DomainValidationError";

describe("Threshold", () => {
  describe("生成", () => {
    it("0 の閾値を生成できる（下限）", () => {
      expect(new Threshold(0).value).toBe(0);
    });

    it("1.0 の閾値を生成できる（上限）", () => {
      expect(new Threshold(1.0).value).toBe(1.0);
    });

    it("範囲内の小数の閾値を生成できる", () => {
      expect(new Threshold(0.65).value).toBe(0.65);
    });

    it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
      "閾値 %f は範囲外のため生成できない",
      (value) => {
        expect(() => new Threshold(value)).toThrow(DomainValidationError);
      },
    );
  });

  describe("既定値", () => {
    it("既定の閾値は 0.6", () => {
      expect(Threshold.default().value).toBe(0.6);
    });
  });

  describe("等価性", () => {
    it("同じ値の閾値は等しい", () => {
      expect(new Threshold(0.6).equals(new Threshold(0.6))).toBe(true);
    });

    it("異なる値の閾値は等しくない", () => {
      expect(new Threshold(0.6).equals(new Threshold(0.7))).toBe(false);
    });
  });
});

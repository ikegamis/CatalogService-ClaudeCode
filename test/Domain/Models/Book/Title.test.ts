import { DomainValidationError } from "Domain/Shared/DomainValidationError";
import { Title } from "Domain/Models/Book/Title";

describe("Title", () => {
  describe("生成", () => {
    it("1文字のタイトルを生成できる（下限）", () => {
      expect(new Title("a").value).toBe("a");
    });

    it("1000文字のタイトルを生成できる（上限）", () => {
      const value = "a".repeat(1000);
      expect(new Title(value).value).toBe(value);
    });

    it("空文字のタイトルは生成できない", () => {
      expect(() => new Title("")).toThrow(DomainValidationError);
    });

    it("1001文字のタイトルは生成できない", () => {
      expect(() => new Title("a".repeat(1001))).toThrow(DomainValidationError);
    });
  });

  describe("等価性", () => {
    it("同じ値を持つタイトルは等しい", () => {
      expect(new Title("ドメイン駆動設計").equals(new Title("ドメイン駆動設計"))).toBe(true);
    });

    it("異なる値を持つタイトルは等しくない", () => {
      expect(new Title("ドメイン駆動設計").equals(new Title("実践ドメイン駆動設計"))).toBe(false);
    });
  });
});

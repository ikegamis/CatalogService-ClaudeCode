import { DomainValidationError } from "Domain/Shared/DomainValidationError";
import { Author } from "Domain/Models/Book/Author";

describe("Author", () => {
  describe("生成", () => {
    it("1文字の著者名を生成できる（下限）", () => {
      expect(new Author("a").value).toBe("a");
    });

    it("100文字の著者名を生成できる（上限）", () => {
      const value = "a".repeat(100);
      expect(new Author(value).value).toBe(value);
    });

    it("空文字の著者名は生成できない", () => {
      expect(() => new Author("")).toThrow(DomainValidationError);
    });

    it("101文字の著者名は生成できない", () => {
      expect(() => new Author("a".repeat(101))).toThrow(DomainValidationError);
    });
  });

  describe("等価性", () => {
    it("同じ値を持つ著者は等しい", () => {
      expect(new Author("山田太郎").equals(new Author("山田太郎"))).toBe(true);
    });

    it("異なる値を持つ著者は等しくない", () => {
      expect(new Author("山田太郎").equals(new Author("鈴木花子"))).toBe(false);
    });
  });
});

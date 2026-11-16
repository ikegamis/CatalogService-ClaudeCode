import { DomainValidationError } from "Domain/Shared/DomainValidationError";
import { BookId } from "Domain/Models/Book/BookId";

describe("BookId", () => {
  describe("生成", () => {
    it("13文字のISBNコードで書籍識別子を生成できる", () => {
      const bookId = new BookId("9784000000000");
      expect(bookId.value).toBe("9784000000000");
    });

    it("12文字では書籍識別子を生成できない", () => {
      expect(() => new BookId("978400000000")).toThrow(DomainValidationError);
    });

    it("14文字では書籍識別子を生成できない", () => {
      expect(() => new BookId("97840000000000")).toThrow(DomainValidationError);
    });

    it("空文字では書籍識別子を生成できない", () => {
      expect(() => new BookId("")).toThrow(DomainValidationError);
    });
  });

  describe("等価性", () => {
    it("同じ値を持つ書籍識別子は等しい", () => {
      expect(new BookId("9784000000000").equals(new BookId("9784000000000"))).toBe(true);
    });

    it("異なる値を持つ書籍識別子は等しくない", () => {
      expect(new BookId("9784000000000").equals(new BookId("9784000000001"))).toBe(false);
    });
  });
});

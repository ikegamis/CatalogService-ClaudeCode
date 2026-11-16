import { DomainValidationError } from "Domain/Shared/DomainValidationError";
import { ReviewId } from "Domain/Models/Review/ReviewId";

const VALID_ULID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

describe("ReviewId", () => {
  describe("生成", () => {
    it("26文字のULIDでレビュー識別子を生成できる", () => {
      expect(new ReviewId(VALID_ULID).value).toBe(VALID_ULID);
    });

    it("25文字ではレビュー識別子を生成できない", () => {
      expect(() => new ReviewId(VALID_ULID.slice(0, 25))).toThrow(DomainValidationError);
    });

    it("27文字ではレビュー識別子を生成できない", () => {
      expect(() => new ReviewId(`${VALID_ULID}0`)).toThrow(DomainValidationError);
    });

    it("空文字ではレビュー識別子を生成できない", () => {
      expect(() => new ReviewId("")).toThrow(DomainValidationError);
    });

    it.each(["I", "L", "O", "U"])(
      "ULIDで使わない文字 %s を含むとレビュー識別子を生成できない",
      (char) => {
        expect(() => new ReviewId(`${VALID_ULID.slice(0, 25)}${char}`)).toThrow(DomainValidationError);
      },
    );

    it("小文字を含むとレビュー識別子を生成できない", () => {
      expect(() => new ReviewId(VALID_ULID.toLowerCase())).toThrow(DomainValidationError);
    });

    it("先頭が8以上のULIDは128bitを超えるため生成できない", () => {
      expect(() => new ReviewId(`8${VALID_ULID.slice(1)}`)).toThrow(DomainValidationError);
    });

    it("先頭が7のULIDは生成できる（上限）", () => {
      const value = `7${"Z".repeat(25)}`;
      expect(new ReviewId(value).value).toBe(value);
    });
  });

  describe("ULIDの自動生成", () => {
    it("生成した識別子は有効なULID形式である", () => {
      const id = ReviewId.generate();
      expect(id.value).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
    });

    it("生成するたびに異なる識別子になる", () => {
      const values = new Set(Array.from({ length: 1000 }, () => ReviewId.generate().value));
      expect(values.size).toBe(1000);
    });

    it("先頭10文字に生成時刻がエンコードされ、後に生成した識別子ほど辞書順で大きいか等しい", () => {
      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
        const earlier = ReviewId.generate();
        jest.setSystemTime(new Date("2026-01-01T00:00:00.001Z"));
        const later = ReviewId.generate();

        expect(earlier.value.slice(0, 10) < later.value.slice(0, 10)).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });

    it("時刻0では時刻部分がすべて0になる", () => {
      jest.useFakeTimers();
      try {
        jest.setSystemTime(0);
        expect(ReviewId.generate().value.slice(0, 10)).toBe("0000000000");
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("等価性", () => {
    it("同じ値を持つレビュー識別子は等しい", () => {
      expect(new ReviewId(VALID_ULID).equals(new ReviewId(VALID_ULID))).toBe(true);
    });

    it("異なる値を持つレビュー識別子は等しくない", () => {
      expect(new ReviewId(VALID_ULID).equals(ReviewId.generate())).toBe(false);
    });
  });
});

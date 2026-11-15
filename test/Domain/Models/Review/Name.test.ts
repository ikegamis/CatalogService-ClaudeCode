import { Name } from "Domain/Models/Review/Name";

describe("Name", () => {
  describe("生成", () => {
    it("1文字の投稿者名を生成できる（下限）", () => {
      expect(new Name("a").value).toBe("a");
    });

    it("50文字の投稿者名を生成できる（上限）", () => {
      const value = "a".repeat(50);
      expect(new Name(value).value).toBe(value);
    });

    it("空文字の投稿者名は生成できない", () => {
      expect(() => new Name("")).toThrow();
    });

    it("51文字の投稿者名は生成できない", () => {
      expect(() => new Name("a".repeat(51))).toThrow();
    });
  });

  describe("前後空白のtrim", () => {
    it("前後の空白は取り除かれる", () => {
      expect(new Name("  山田太郎 \t").value).toBe("山田太郎");
    });

    it("全角空白も取り除かれる", () => {
      expect(new Name("　山田太郎　").value).toBe("山田太郎");
    });

    it("途中の空白は保持される", () => {
      expect(new Name(" 山田 太郎 ").value).toBe("山田 太郎");
    });

    it("空白のみの投稿者名はtrim後に空となるため生成できない", () => {
      expect(() => new Name("   ")).toThrow();
    });

    it("trim後に50文字なら前後に空白があっても生成できる", () => {
      const value = "a".repeat(50);
      expect(new Name(`  ${value}  `).value).toBe(value);
    });

    it("trim後に51文字なら生成できない", () => {
      expect(() => new Name(` ${"a".repeat(51)} `)).toThrow();
    });
  });

  describe("等価性", () => {
    it("同じ名前の投稿者は同一とみなす", () => {
      expect(new Name("山田太郎").equals(new Name("山田太郎"))).toBe(true);
    });

    it("前後空白だけが異なる投稿者名は等しい", () => {
      expect(new Name(" 山田太郎").equals(new Name("山田太郎 "))).toBe(true);
    });

    it("異なる名前の投稿者は等しくない", () => {
      expect(new Name("山田太郎").equals(new Name("鈴木花子"))).toBe(false);
    });
  });
});

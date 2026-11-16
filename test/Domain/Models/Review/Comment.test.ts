import { DomainValidationError } from "Domain/Shared/DomainValidationError";
import { Comment } from "Domain/Models/Review/Comment";

describe("Comment", () => {
  describe("生成", () => {
    it("1文字のコメントを生成できる（下限）", () => {
      expect(new Comment("a").value).toBe("a");
    });

    it("1000文字のコメントを生成できる（上限）", () => {
      const value = "a".repeat(1000);
      expect(new Comment(value).value).toBe(value);
    });

    it("空文字のコメントは生成できない", () => {
      expect(() => new Comment("")).toThrow(DomainValidationError);
    });

    it("1001文字のコメントは生成できない", () => {
      expect(() => new Comment("a".repeat(1001))).toThrow(DomainValidationError);
    });
  });

  describe("品質係数", () => {
    it.each([
      [1, 0.2],
      [9, 0.2],
      [10, 0.2],
      [55, 0.6],
      [99, 0.2 + (89 / 90) * 0.8],
      [100, 1.0],
      [1000, 1.0],
    ])("%i文字のコメントの品質係数は %f", (length, expected) => {
      expect(new Comment("a".repeat(length)).getQualityFactor()).toBeCloseTo(expected);
    });

    it("10文字以上100文字未満では文字数が増えるほど品質係数が上がる", () => {
      const shorter = new Comment("a".repeat(30)).getQualityFactor();
      const longer = new Comment("a".repeat(31)).getQualityFactor();
      expect(longer).toBeGreaterThan(shorter);
    });
  });

  describe("正規表現による抽出", () => {
    it("一致する部分文字列をすべて返す", () => {
      const comment = new Comment("『A』と『B』と『C』");
      expect(comment.extractMatches(/『[^』]+』/g)).toEqual(["『A』", "『B』", "『C』"]);
    });

    it("グローバルフラグがない正規表現でもすべての一致を返す", () => {
      const comment = new Comment("『A』と『B』");
      expect(comment.extractMatches(/『[^』]+』/)).toEqual(["『A』", "『B』"]);
    });

    it("グローバルフラグ以外のフラグは保持される", () => {
      const comment = new Comment("abc ABC");
      expect(comment.extractMatches(/abc/i)).toEqual(["abc", "ABC"]);
    });

    it("一致しない場合は空配列を返す", () => {
      expect(new Comment("書籍名なし").extractMatches(/『[^』]+』/)).toEqual([]);
    });

    it("引数の正規表現オブジェクトを変更しない", () => {
      const pattern = /『[^』]+』/;
      new Comment("『A』").extractMatches(pattern);
      expect(pattern.global).toBe(false);
    });
  });

  describe("等価性", () => {
    it("同じ内容のコメントは等しい", () => {
      expect(new Comment("良い本").equals(new Comment("良い本"))).toBe(true);
    });

    it("異なる内容のコメントは等しくない", () => {
      expect(new Comment("良い本").equals(new Comment("悪い本"))).toBe(false);
    });
  });
});

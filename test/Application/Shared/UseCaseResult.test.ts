import { DomainValidationError } from "Domain/Shared/DomainValidationError";
import { failure, parseInput, success } from "Application/Shared/UseCaseResult";

describe("UseCaseResult", () => {
  it("success は ok: true とデータを返す", () => {
    expect(success(1)).toEqual({ ok: true, data: 1 });
  });

  it("failure は ok: false とエラー分類・理由を返す", () => {
    expect(failure("BOOK_NOT_FOUND", "理由")).toEqual({
      ok: false,
      error: { code: "BOOK_NOT_FOUND", message: "理由" },
    });
  });

  describe("parseInput", () => {
    it("生成に成功したら成功結果を返す", () => {
      expect(parseInput(() => "value")).toEqual({ ok: true, data: "value" });
    });

    it("DomainValidationError は VALIDATION_ERROR の失敗結果に変換する", () => {
      const result = parseInput(() => {
        throw new DomainValidationError("不正な値");
      });
      expect(result).toEqual({ ok: false, error: { code: "VALIDATION_ERROR", message: "不正な値" } });
    });

    it("DomainValidationError 以外の例外は技術的障害として再送出する", () => {
      expect(() =>
        parseInput(() => {
          throw new TypeError("unexpected");
        }),
      ).toThrow(TypeError);
    });
  });
});

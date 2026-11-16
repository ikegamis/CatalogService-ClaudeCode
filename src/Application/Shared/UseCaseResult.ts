import { DomainValidationError } from "Domain/Shared/DomainValidationError";

/**
 * ユースケースが業務上・入力上の理由で失敗したときの分類。
 * 技術的な障害（リポジトリの例外など）はここに含めず、例外のまま呼び出し元へ伝播させる。
 */
export type UseCaseErrorCode =
  /** 入力値がドメインの制約を満たさない。 */
  | "VALIDATION_ERROR"
  /** 登録しようとした書籍IDが既に登録されている（UC-BOOK-001）。 */
  | "BOOK_ALREADY_EXISTS"
  /** レビュー対象の書籍が登録されていない（UC-REVIEW-001）。 */
  | "BOOK_NOT_FOUND"
  /** 指定したレビューIDのレビューが登録されていない（UC-REVIEW-002 / UC-CATALOG-003）。 */
  | "REVIEW_NOT_FOUND";

export type UseCaseError = {
  code: UseCaseErrorCode;
  /** 失敗理由のテキスト。内部例外の情報は含めない。 */
  message: string;
};

/** ユースケースの結果。成功・失敗を ok で判別する（UC 定義の「登録成功・失敗を示す boolean 値」に対応）。 */
export type UseCaseResult<T> = { ok: true; data: T } | { ok: false; error: UseCaseError };

export const success = <T>(data: T): UseCaseResult<T> => ({ ok: true, data });

export const failure = <T = never>(code: UseCaseErrorCode, message: string): UseCaseResult<T> => ({
  ok: false,
  error: { code, message },
});

/**
 * 入力値から値オブジェクト等を生成する。ドメインの制約違反は VALIDATION_ERROR の失敗結果に変換し、
 * それ以外の例外は技術的な障害として再送出する。
 */
export const parseInput = <T>(build: () => T): UseCaseResult<T> => {
  try {
    return success(build());
  } catch (error) {
    if (error instanceof DomainValidationError) {
      return failure("VALIDATION_ERROR", error.message);
    }
    throw error;
  }
};

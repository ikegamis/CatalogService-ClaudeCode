import { UseCaseError } from "Application/Shared/UseCaseResult";

/**
 * HTTP リクエストの形式（JSON の型・必須項目など）が API 仕様を満たさないことを表す。
 * 値域などの業務上の制約は Domain が検証するため、ここでは扱わない。
 */
export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

/** ユースケースが業務上・入力上の理由で失敗したことを表す。message は Application が利用者向けに作成したもの。 */
export class UseCaseFailedError extends Error {
  constructor(readonly error: UseCaseError) {
    super(error.message);
    this.name = "UseCaseFailedError";
  }
}

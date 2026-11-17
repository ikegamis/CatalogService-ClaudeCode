import { ErrorRequestHandler } from "express";

import { RequestValidationError, UseCaseFailedError } from "./HttpErrors";

/**
 * 失敗時のステータスコード。
 * API 仕様（doc/presentation/openapi.yml）と UC 定義（doc/application/catalog-use-cases.md）は
 * 失敗応答として 500（5xx）と FalseMessage のみを定義しているため、失敗の種類によらず 500 を返す。
 */
const FAILURE_STATUS = 500;

/** 予期しない例外の応答メッセージ。内部例外・SQL・スタックトレースを応答に含めない。 */
export const INTERNAL_ERROR_MESSAGE = "サーバー内部でエラーが発生しました。";
export const INVALID_JSON_MESSAGE = "リクエストボディが不正な JSON です。";
export const PAYLOAD_TOO_LARGE_MESSAGE = "リクエストボディが大きすぎます。";

/** express.json()（body-parser）が投げるエラーの判別に使う。 */
const bodyParserErrorType = (error: unknown): string | undefined => {
  if (typeof error === "object" && error !== null && "type" in error && typeof error.type === "string") {
    return error.type;
  }
  return undefined;
};

/**
 * 全エンドポイント共通のエラー変換（Express 5 は async ハンドラーの rejection をここへ伝播する）。
 * 応答は FalseMessage（{ ok: false, message }）に統一する。
 */
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const message = toClientMessage(error);
  if (message === INTERNAL_ERROR_MESSAGE) {
    // 原因調査のためサーバー側にのみ記録する。リクエストの内容（個人情報を含みうる）は記録しない。
    console.error("予期しないエラーが発生しました:", error instanceof Error ? (error.stack ?? error.message) : error);
  }
  res.status(FAILURE_STATUS).json({ ok: false, message });
};

const toClientMessage = (error: unknown): string => {
  if (error instanceof RequestValidationError || error instanceof UseCaseFailedError) {
    return error.message;
  }
  switch (bodyParserErrorType(error)) {
    case "entity.parse.failed":
      return INVALID_JSON_MESSAGE;
    case "entity.too.large":
      return PAYLOAD_TOO_LARGE_MESSAGE;
    default:
      return INTERNAL_ERROR_MESSAGE;
  }
};

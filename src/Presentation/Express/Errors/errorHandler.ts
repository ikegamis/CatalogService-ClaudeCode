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
export const UNSUPPORTED_CHARSET_MESSAGE = "リクエストボディの文字コード（charset）に対応していません。";
export const UNSUPPORTED_ENCODING_MESSAGE = "リクエストボディの Content-Encoding に対応していません。";
export const REQUEST_ABORTED_MESSAGE = "リクエストボディの受信が中断されました。";
export const REQUEST_SIZE_INVALID_MESSAGE = "リクエストボディのサイズが Content-Length と一致しません。";
export const INVALID_PATH_ENCODING_MESSAGE = "URL のパスに不正なエンコードが含まれています。";

/**
 * express.json()（body-parser）が投げる、クライアント起因のエラーの種類ごとの理由。
 * stream.encoding.set など、サーバー側の実装不備を表す種類は含めない（予期しないエラーとして扱う）。
 */
const BODY_PARSER_MESSAGES: Readonly<Record<string, string>> = {
  "entity.parse.failed": INVALID_JSON_MESSAGE,
  "entity.too.large": PAYLOAD_TOO_LARGE_MESSAGE,
  "charset.unsupported": UNSUPPORTED_CHARSET_MESSAGE,
  "encoding.unsupported": UNSUPPORTED_ENCODING_MESSAGE,
  "request.aborted": REQUEST_ABORTED_MESSAGE,
  "request.size.invalid": REQUEST_SIZE_INVALID_MESSAGE,
};

type ClientError = { message: string; status: number; expose?: unknown; type?: unknown };

/** Express / body-parser が投げる http-errors 形式のエラーのうち、4xx（クライアント起因）のもの。 */
const asClientError = (error: unknown): ClientError | undefined => {
  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return error as Error & ClientError;
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
  if (message === undefined) {
    // 原因調査のためサーバー側にのみ記録する。リクエストの内容（個人情報を含みうる）は記録しない。
    console.error("予期しないエラーが発生しました:", error instanceof Error ? (error.stack ?? error.message) : error);
  }
  res.status(FAILURE_STATUS).json({ ok: false, message: message ?? INTERNAL_ERROR_MESSAGE });
};

/** クライアントに理由を返せるエラーならその理由を、予期しないエラーなら undefined を返す。 */
const toClientMessage = (error: unknown): string | undefined => {
  if (error instanceof RequestValidationError || error instanceof UseCaseFailedError) {
    return error.message;
  }

  const clientError = asClientError(error);
  if (clientError === undefined) {
    return undefined;
  }
  if (typeof clientError.type === "string" && clientError.type in BODY_PARSER_MESSAGES) {
    return BODY_PARSER_MESSAGES[clientError.type];
  }
  // router はパスパラメーターを decodeURIComponent できないとき、status 400 の URIError を投げる
  if (error instanceof URIError) {
    return INVALID_PATH_ENCODING_MESSAGE;
  }
  // その他の 4xx のうち、公開してよいと明示されたもの（http-errors の expose）はライブラリの理由をそのまま返す
  if (clientError.expose === true) {
    return clientError.message;
  }
  return undefined;
};

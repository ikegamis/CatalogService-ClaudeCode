import { RequestValidationError } from "Presentation/Express/Errors/HttpErrors";

/**
 * HTTP 入力の実行時検証。JSON の型と必須項目だけを検証する（openapi.yml のスキーマ）。
 * 文字数・値域・整数であることなどの業務上の制約は、Application 経由で Domain の値オブジェクトが検証する。
 */
export type JsonObject = Record<string, unknown>;

export const requireJsonObject = (body: unknown): JsonObject => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new RequestValidationError("リクエストボディは JSON オブジェクトである必要があります。");
  }
  return body as JsonObject;
};

export const requireString = (object: JsonObject, key: string): string => {
  const value = object[key];
  if (typeof value !== "string") {
    throw new RequestValidationError(`${key} は必須の文字列です。`);
  }
  return value;
};

/** JSON の数値は有限値のみ。整数であるかは Domain（Price / Rating）が検証する。 */
export const requireNumber = (object: JsonObject, key: string): number => {
  const value = object[key];
  if (typeof value !== "number") {
    throw new RequestValidationError(`${key} は必須の数値です。`);
  }
  return value;
};

/** 省略（undefined）・null・文字列を許す項目（openapi.yml の type: [string, "null"]、required 外）。 */
export const optionalNullableString = (object: JsonObject, key: string): string | null | undefined => {
  const value = object[key];
  if (value === undefined || value === null || typeof value === "string") {
    return value;
  }
  throw new RequestValidationError(`${key} は文字列または null である必要があります。`);
};

/** 10進数の数値表記のみを受け付ける（Number() が受け付ける ""、"0x1"、"Infinity" などを除外する）。 */
const DECIMAL_NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/** 省略可能な数値のクエリパラメーター。省略時は undefined を返す。 */
export const optionalNumberQuery = (value: unknown, key: string): number | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !DECIMAL_NUMBER.test(value)) {
    throw new RequestValidationError(`${key} は数値である必要があります。`);
  }
  return Number(value);
};

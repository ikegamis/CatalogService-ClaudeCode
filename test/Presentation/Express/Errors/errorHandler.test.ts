import { NextFunction, Request, Response } from "express";

import {
  errorHandler,
  INTERNAL_ERROR_MESSAGE,
  REQUEST_ABORTED_MESSAGE,
  REQUEST_SIZE_INVALID_MESSAGE,
} from "Presentation/Express/Errors/errorHandler";

/**
 * HTTP で再現しにくい種類（受信の中断、Content-Length の不一致、ライブラリ由来の 4xx / 5xx）の変換を確認する。
 * HTTP で再現できる種類は BookController / ReviewController のテストで扱う。
 */
const httpError = (status: number, message: string, props: Record<string, unknown> = {}): Error =>
  Object.assign(new Error(message), { status, statusCode: status, expose: status < 500, ...props });

const invoke = (error: unknown) => {
  const res = { headersSent: false, status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  const next = jest.fn() as NextFunction;
  errorHandler(error, {} as Request, res as unknown as Response, next);
  return { res, next };
};

describe("errorHandler", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it.each([
    ["request.aborted", REQUEST_ABORTED_MESSAGE],
    ["request.size.invalid", REQUEST_SIZE_INVALID_MESSAGE],
  ])("body-parser の %s は 500 と理由を返し、記録しない", (type, expected) => {
    const { res } = invoke(httpError(400, "library message", { type }));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: expected });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("公開してよい（expose）その他の 4xx はライブラリの理由を返し、記録しない", () => {
    const { res } = invoke(httpError(415, 'unsupported media type "text/csv"'));

    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'unsupported media type "text/csv"' });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each([
    ["expose でない 4xx", httpError(400, "internal detail", { expose: false })],
    ["5xx の http-errors（stream.encoding.set など）", httpError(500, "stream encoding should not be set", { type: "stream.encoding.set" })],
    ["status を持たない例外", new Error("connection refused")],
  ])("%s は汎用メッセージを返し、予期しないエラーとして記録する", (_label, error) => {
    const { res } = invoke(error);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: INTERNAL_ERROR_MESSAGE });
    expect(consoleError).toHaveBeenCalled();
  });

  it("応答の送信を始めた後は Express の既定の処理に任せる", () => {
    const res = { headersSent: true, status: jest.fn(), json: jest.fn() };
    const next = jest.fn();
    const error = new Error("late");

    errorHandler(error, {} as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});

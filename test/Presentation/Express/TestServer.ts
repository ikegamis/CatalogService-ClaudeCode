import { AddressInfo } from "node:net";
import { Server } from "node:http";

import { Express } from "express";

import { BookDto } from "Application/Services/Book/BookDto";
import { RecommendBooksDto, RecommendBooksQuery } from "Application/Services/Book/RecommendBooksService";
import { RegisterBookCommand } from "Application/Services/Book/RegisterBookService";
import { DeleteReviewCommand, DeleteReviewDto } from "Application/Services/Review/DeleteReviewService";
import { RegisterReviewCommand } from "Application/Services/Review/RegisterReviewService";
import { ReviewDto } from "Application/Services/Review/ReviewDto";
import { UpdateReviewCommand } from "Application/Services/Review/UpdateReviewService";
import { UseCaseResult } from "Application/Shared/UseCaseResult";
import { createApp } from "Presentation/Express/app";
import { BookController } from "Presentation/Express/Controllers/BookController";
import { ReviewController } from "Presentation/Express/Controllers/ReviewController";

/** 実際に HTTP で待ち受けるテスト用サーバー（ポートは OS に任せる）。 */
export type TestServer = {
  url: (path: string) => string;
  close: () => Promise<void>;
};

export const startServer = async (app: Express): Promise<TestServer> => {
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: (path) => `http://127.0.0.1:${port}${path}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
};

type Execute<I, O> = jest.Mock<Promise<UseCaseResult<O>>, [I]>;

/** Controller が呼ぶユースケースのテストダブル。テストごとに新しく生成する。 */
export type UseCaseDoubles = {
  registerBook: { execute: Execute<RegisterBookCommand, BookDto> };
  recommendBooks: { execute: Execute<RecommendBooksQuery, RecommendBooksDto> };
  registerReview: { execute: Execute<RegisterReviewCommand, ReviewDto> };
  updateReview: { execute: Execute<UpdateReviewCommand, ReviewDto> };
  deleteReview: { execute: Execute<DeleteReviewCommand, DeleteReviewDto> };
};

export const createUseCaseDoubles = (): UseCaseDoubles => ({
  registerBook: { execute: jest.fn() },
  recommendBooks: { execute: jest.fn() },
  registerReview: { execute: jest.fn() },
  updateReview: { execute: jest.fn() },
  deleteReview: { execute: jest.fn() },
});

export const createTestApp = (doubles: UseCaseDoubles): Express =>
  createApp({
    bookController: new BookController(doubles.registerBook, doubles.recommendBooks),
    reviewController: new ReviewController(doubles.registerReview, doubles.updateReview, doubles.deleteReview),
  });

export const sendJson = (url: string, method: string, body: unknown): Promise<Response> =>
  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

/** 応答が FalseMessage（{ ok: false, message }）であることを確認して message を返す。 */
export const expectFailure = async (response: Response, status = 500): Promise<string> => {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toMatch(/^application\/json/);
  const body = (await response.json()) as { ok: unknown; message: unknown };
  expect(Object.keys(body).sort()).toEqual(["message", "ok"]);
  expect(body.ok).toBe(false);
  expect(typeof body.message).toBe("string");
  return body.message as string;
};

import express, { Express } from "express";

import { BookController } from "./Controllers/BookController";
import { ReviewController } from "./Controllers/ReviewController";
import { errorHandler } from "./Errors/errorHandler";

export type Controllers = {
  bookController: BookController;
  reviewController: ReviewController;
};

/**
 * Express アプリを生成する（listen はしない。起動は index.ts）。
 * ルーティングは doc/presentation/api-specification.md の対応表のとおり。
 */
export const createApp = ({ bookController, reviewController }: Controllers): Express => {
  const app = express();
  // 応答ヘッダーから使用フレームワークを公開しない
  app.disable("x-powered-by");
  // 条件付き GET（ETag / 304）は API 仕様に含めない。有効のままだと If-None-Match に対して空ボディの 304 を返してしまう。
  // ETag を付けないだけでは「If-None-Match: *」が fresh と判定されて 304 になるため、このアプリの req.fresh を常に false にする
  app.set("etag", false);
  Object.defineProperty(app.request, "fresh", { configurable: true, enumerable: true, get: () => false });
  // HEAD は API 仕様に含めない。Express は GET のルートで HEAD にも自動で応答するため、
  // ルーティングから外して仕様にないリクエストと同じ扱い（Express 既定の 404）にする
  app.use((req, _res, next) => {
    next(req.method === "HEAD" ? "router" : undefined);
  });
  app.use(express.json());

  app.post("/book", bookController.create);
  app.get("/book/:isbn/recommendations", bookController.getRecommendations);
  app.post("/review", reviewController.create);
  app.put("/review/:id", reviewController.update);
  app.delete("/review/:id", reviewController.delete);

  app.use(errorHandler);
  return app;
};

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
  app.use(express.json());

  app.post("/book", bookController.create);
  app.get("/book/:isbn/recommendations", bookController.getRecommendations);
  app.post("/review", reviewController.create);
  app.put("/review/:id", reviewController.update);
  app.delete("/review/:id", reviewController.delete);

  app.use(errorHandler);
  return app;
};

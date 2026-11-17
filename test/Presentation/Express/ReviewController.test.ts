import { failure, success } from "Application/Shared/UseCaseResult";
import {
  INTERNAL_ERROR_MESSAGE,
  INVALID_JSON_MESSAGE,
  INVALID_PATH_ENCODING_MESSAGE,
} from "Presentation/Express/Errors/errorHandler";

import {
  createTestApp,
  createUseCaseDoubles,
  expectFailure,
  sendJson,
  startServer,
  TestServer,
  UseCaseDoubles,
} from "./TestServer";

const REVIEW_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const ISBN = "9784000000000";
const reviewDto = { reviewId: REVIEW_ID, bookId: ISBN, name: "山田", rating: 4, comment: "良い本でした" };
const reviewResponse = { id: REVIEW_ID, bookId: ISBN, name: "山田", rating: 4, comment: "良い本でした" };
const reviewRequest = { bookId: ISBN, name: "山田", rating: 4, comment: "良い本でした" };

const sendRawJson = (url: string, method: string, body: string): Promise<Response> =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body });

describe("Review API", () => {
  let doubles: UseCaseDoubles;
  let server: TestServer;
  let consoleError: jest.SpyInstance;

  beforeEach(async () => {
    doubles = createUseCaseDoubles();
    server = await startServer(createTestApp(doubles));
    consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    consoleError.mockRestore();
    await server.close();
  });

  describe("POST /review", () => {
    it("登録に成功すると 201 と登録したレビューを返す", async () => {
      doubles.registerReview.execute.mockResolvedValue(success(reviewDto));

      const response = await sendJson(server.url("/review"), "POST", reviewRequest);

      expect(response.status).toBe(201);
      expect(response.headers.get("content-type")).toMatch(/^application\/json/);
      expect(await response.json()).toEqual({ ok: true, review: reviewResponse });
      expect(doubles.registerReview.execute).toHaveBeenCalledWith(reviewRequest);
    });

    it("name・comment を省略した場合は undefined のまま渡し、コメントなしは null で返す", async () => {
      doubles.registerReview.execute.mockResolvedValue(success({ ...reviewDto, name: "名無し", comment: null }));

      const response = await sendJson(server.url("/review"), "POST", { bookId: ISBN, rating: 3 });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ ok: true, review: { ...reviewResponse, name: "名無し", comment: null } });
      expect(doubles.registerReview.execute).toHaveBeenCalledWith({
        bookId: ISBN,
        name: undefined,
        rating: 3,
        comment: undefined,
      });
    });

    it("name・comment の null はそのまま渡す", async () => {
      doubles.registerReview.execute.mockResolvedValue(success(reviewDto));

      await sendJson(server.url("/review"), "POST", { bookId: ISBN, name: null, rating: 3, comment: null });

      expect(doubles.registerReview.execute).toHaveBeenCalledWith({ bookId: ISBN, name: null, rating: 3, comment: null });
    });

    it.each([
      ["bookId がない", { rating: 3 }, "bookId は必須の文字列です。"],
      ["rating がない", { bookId: ISBN }, "rating は必須の数値です。"],
      ["rating が文字列", { bookId: ISBN, rating: "3" }, "rating は必須の数値です。"],
      ["name が数値", { bookId: ISBN, rating: 3, name: 1 }, "name は文字列または null である必要があります。"],
      ["comment がオブジェクト", { bookId: ISBN, rating: 3, comment: {} }, "comment は文字列または null である必要があります。"],
    ])("%s場合は 500 と理由を返し、ユースケースを呼ばない", async (_label, body, expected) => {
      const response = await sendJson(server.url("/review"), "POST", body);

      expect(await expectFailure(response)).toBe(expected);
      expect(doubles.registerReview.execute).not.toHaveBeenCalled();
    });

    it.each([
      ["ボディが配列", JSON.stringify([reviewRequest]), "リクエストボディは JSON オブジェクトである必要があります。"],
      ["ボディが不正な JSON", '{"bookId": ', INVALID_JSON_MESSAGE],
    ])("%sの場合は 500 と理由を返し、ユースケースを呼ばない", async (_label, body, expected) => {
      const response = await sendRawJson(server.url("/review"), "POST", body);

      expect(await expectFailure(response)).toBe(expected);
      expect(doubles.registerReview.execute).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("対象の書籍が登録されていない場合は 500 とその理由を返す", async () => {
      doubles.registerReview.execute.mockResolvedValue(
        failure("BOOK_NOT_FOUND", "書籍ID '9784000000000' の書籍は登録されていません。"),
      );

      const response = await sendJson(server.url("/review"), "POST", reviewRequest);

      expect(await expectFailure(response)).toBe("書籍ID '9784000000000' の書籍は登録されていません。");
    });

    it("予期しない例外は 500 と汎用メッセージを返す", async () => {
      doubles.registerReview.execute.mockRejectedValue(new Error("INSERT INTO review failed"));

      const response = await sendJson(server.url("/review"), "POST", reviewRequest);

      expect(await expectFailure(response)).toBe(INTERNAL_ERROR_MESSAGE);
      expect(consoleError).toHaveBeenCalled();
    });
  });

  describe("PUT /review/{id}", () => {
    it("更新に成功すると 200 と更新後のレビューを返す", async () => {
      doubles.updateReview.execute.mockResolvedValue(success(reviewDto));

      const response = await sendJson(server.url(`/review/${REVIEW_ID}`), "PUT", reviewRequest);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/^application\/json/);
      expect(await response.json()).toEqual({ ok: true, review: reviewResponse });
      expect(doubles.updateReview.execute).toHaveBeenCalledWith({ reviewId: REVIEW_ID, ...reviewRequest });
    });

    it("レビューIDはパスの値を使い、ボディの id は使わない", async () => {
      doubles.updateReview.execute.mockResolvedValue(success(reviewDto));

      await sendJson(server.url(`/review/${REVIEW_ID}`), "PUT", { ...reviewRequest, id: "OTHER", reviewId: "OTHER" });

      expect(doubles.updateReview.execute).toHaveBeenCalledWith({ reviewId: REVIEW_ID, ...reviewRequest });
    });

    it.each([
      ["bookId がない", { rating: 3 }, "bookId は必須の文字列です。"],
      ["rating がない", { bookId: ISBN }, "rating は必須の数値です。"],
      ["rating が文字列", { bookId: ISBN, rating: "3" }, "rating は必須の数値です。"],
      ["name が数値", { bookId: ISBN, rating: 3, name: 1 }, "name は文字列または null である必要があります。"],
      ["comment がオブジェクト", { bookId: ISBN, rating: 3, comment: {} }, "comment は文字列または null である必要があります。"],
    ])("%s場合は 500 と理由を返し、ユースケースを呼ばない", async (_label, body, expected) => {
      const response = await sendJson(server.url(`/review/${REVIEW_ID}`), "PUT", body);

      expect(await expectFailure(response)).toBe(expected);
      expect(doubles.updateReview.execute).not.toHaveBeenCalled();
    });

    it.each([
      ["ボディが配列", JSON.stringify([reviewRequest]), "リクエストボディは JSON オブジェクトである必要があります。"],
      ["ボディが不正な JSON", '{"bookId": ', INVALID_JSON_MESSAGE],
    ])("%sの場合は 500 と理由を返し、ユースケースを呼ばない", async (_label, body, expected) => {
      const response = await sendRawJson(server.url(`/review/${REVIEW_ID}`), "PUT", body);

      expect(await expectFailure(response)).toBe(expected);
      expect(doubles.updateReview.execute).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("パスのレビューIDのエンコードが不正な場合は 500 と理由を返し、予期しないエラーとして記録しない", async () => {
      const response = await sendJson(server.url("/review/%E0%A4%A"), "PUT", reviewRequest);

      expect(await expectFailure(response)).toBe(INVALID_PATH_ENCODING_MESSAGE);
      expect(doubles.updateReview.execute).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("レビューが登録されていない場合は 500 とその理由を返す", async () => {
      doubles.updateReview.execute.mockResolvedValue(
        failure("REVIEW_NOT_FOUND", `レビューID '${REVIEW_ID}' のレビューは登録されていません。`),
      );

      const response = await sendJson(server.url(`/review/${REVIEW_ID}`), "PUT", reviewRequest);

      expect(await expectFailure(response)).toBe(`レビューID '${REVIEW_ID}' のレビューは登録されていません。`);
    });

    it("予期しない例外は 500 と汎用メッセージを返す", async () => {
      doubles.updateReview.execute.mockRejectedValue(new Error("UPDATE review failed"));

      const response = await sendJson(server.url(`/review/${REVIEW_ID}`), "PUT", reviewRequest);

      expect(await expectFailure(response)).toBe(INTERNAL_ERROR_MESSAGE);
    });
  });

  describe("DELETE /review/{id}", () => {
    it("削除に成功すると 200 と削除メッセージを返す", async () => {
      doubles.deleteReview.execute.mockResolvedValue(success({ reviewId: REVIEW_ID }));

      const response = await fetch(server.url(`/review/${REVIEW_ID}`), { method: "DELETE" });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/^application\/json/);
      expect(await response.json()).toEqual({ ok: true, message: `'${REVIEW_ID}' は削除されました` });
      expect(doubles.deleteReview.execute).toHaveBeenCalledWith({ reviewId: REVIEW_ID });
    });

    it.each([
      ["レビューが登録されていない", failure("REVIEW_NOT_FOUND", `レビューID '${REVIEW_ID}' のレビューは登録されていません。`)],
      ["レビューIDの形式が不正", failure("VALIDATION_ERROR", "ReviewIdは26文字のULIDである必要があります。")],
    ])("ユースケースが失敗（%s）した場合は 500 とその理由を返す", async (_label, result) => {
      doubles.deleteReview.execute.mockResolvedValue(result);

      const response = await fetch(server.url(`/review/${REVIEW_ID}`), { method: "DELETE" });

      expect(await expectFailure(response)).toBe(result.ok ? "" : result.error.message);
    });

    it("パスのレビューIDのエンコードが不正な場合は 500 と理由を返し、予期しないエラーとして記録しない", async () => {
      const response = await fetch(server.url("/review/%E0%A4%A"), { method: "DELETE" });

      expect(await expectFailure(response)).toBe(INVALID_PATH_ENCODING_MESSAGE);
      expect(doubles.deleteReview.execute).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("予期しない例外は 500 と汎用メッセージを返す", async () => {
      doubles.deleteReview.execute.mockRejectedValue(new Error("DELETE review failed"));

      const response = await fetch(server.url(`/review/${REVIEW_ID}`), { method: "DELETE" });

      expect(await expectFailure(response)).toBe(INTERNAL_ERROR_MESSAGE);
    });
  });
});

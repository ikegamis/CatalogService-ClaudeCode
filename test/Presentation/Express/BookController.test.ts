import { failure, success } from "Application/Shared/UseCaseResult";
import {
  INTERNAL_ERROR_MESSAGE,
  INVALID_JSON_MESSAGE,
  PAYLOAD_TOO_LARGE_MESSAGE,
  UNSUPPORTED_CHARSET_MESSAGE,
  UNSUPPORTED_ENCODING_MESSAGE,
} from "Presentation/Express/Errors/errorHandler";

import {
  createTestApp,
  createUseCaseDoubles,
  expectFailure,
  expectRawFailure,
  sendJson,
  sendRaw,
  startServer,
  TestServer,
  UseCaseDoubles,
} from "./TestServer";

const ISBN = "9784000000000";
const bookDto = { bookId: ISBN, title: "ドメイン駆動設計入門", author: "著者A", price: 3000 };
const bookRequest = { isbn: ISBN, title: "ドメイン駆動設計入門", author: "著者A", price: 3000 };

describe("Book API", () => {
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

  describe("POST /book", () => {
    it("登録に成功すると 201 と登録した書籍を返す", async () => {
      doubles.registerBook.execute.mockResolvedValue(success(bookDto));

      const response = await sendJson(server.url("/book"), "POST", bookRequest);

      expect(response.status).toBe(201);
      expect(response.headers.get("content-type")).toMatch(/^application\/json/);
      expect(response.headers.get("x-powered-by")).toBeNull();
      expect(await response.json()).toEqual({ ok: true, book: bookRequest });
      expect(doubles.registerBook.execute).toHaveBeenCalledWith({
        bookId: ISBN,
        title: "ドメイン駆動設計入門",
        author: "著者A",
        price: 3000,
      });
    });

    it("仕様にないボディの項目はユースケースに渡さない", async () => {
      doubles.registerBook.execute.mockResolvedValue(success(bookDto));

      await sendJson(server.url("/book"), "POST", { ...bookRequest, extra: "x" });

      expect(doubles.registerBook.execute.mock.calls[0][0]).not.toHaveProperty("extra");
    });

    it.each([
      ["isbn がない", { title: "t", author: "a", price: 1 }, "isbn は必須の文字列です。"],
      ["title が文字列でない", { ...bookRequest, title: 1 }, "title は必須の文字列です。"],
      ["author が null", { ...bookRequest, author: null }, "author は必須の文字列です。"],
      ["price が文字列", { ...bookRequest, price: "3000" }, "price は必須の数値です。"],
      ["ボディが配列", [bookRequest], "リクエストボディは JSON オブジェクトである必要があります。"],
    ])("%s場合は 500 と理由を返し、ユースケースを呼ばない", async (_label, body, expected) => {
      const response = await sendJson(server.url("/book"), "POST", body);

      expect(await expectFailure(response)).toBe(expected);
      expect(doubles.registerBook.execute).not.toHaveBeenCalled();
    });

    it("Content-Type が JSON でない場合は 500 を返す", async () => {
      const response = await fetch(server.url("/book"), { method: "POST", body: JSON.stringify(bookRequest) });

      expect(await expectFailure(response)).toBe("リクエストボディは JSON オブジェクトである必要があります。");
      expect(doubles.registerBook.execute).not.toHaveBeenCalled();
    });

    it("不正な JSON の場合は 500 を返し、解析エラーの詳細を含めない", async () => {
      const response = await fetch(server.url("/book"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"isbn": ',
      });

      expect(await expectFailure(response)).toBe(INVALID_JSON_MESSAGE);
      expect(doubles.registerBook.execute).not.toHaveBeenCalled();
    });

    it("ボディが大きすぎる場合は 500 を返す", async () => {
      const response = await sendJson(server.url("/book"), "POST", { ...bookRequest, title: "a".repeat(200_000) });

      expect(await expectFailure(response)).toBe(PAYLOAD_TOO_LARGE_MESSAGE);
      expect(doubles.registerBook.execute).not.toHaveBeenCalled();
    });

    it.each([
      ["charset が UTF-8 以外", { "Content-Type": "application/json; charset=latin2" }, UNSUPPORTED_CHARSET_MESSAGE],
      [
        "Content-Encoding に対応していない",
        { "Content-Type": "application/json", "Content-Encoding": "compress" },
        UNSUPPORTED_ENCODING_MESSAGE,
      ],
    ])("%s場合は 500 と理由を返し、予期しないエラーとして記録しない", async (_label, headers, expected) => {
      const response = await sendRaw(server.url("/book"), { method: "POST", headers, body: JSON.stringify(bookRequest) });

      expect(expectRawFailure(response)).toBe(expected);
      expect(doubles.registerBook.execute).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it.each([
      ["既に登録されている", failure("BOOK_ALREADY_EXISTS", "書籍ID '9784000000000' は既に登録されています。")],
      ["ドメインの制約違反", failure("VALIDATION_ERROR", "Priceは整数円である必要があります。")],
    ])("ユースケースが失敗（%s）した場合は 500 とその理由を返す", async (_label, result) => {
      doubles.registerBook.execute.mockResolvedValue(result);

      const response = await sendJson(server.url("/book"), "POST", bookRequest);

      expect(await expectFailure(response)).toBe(result.ok ? "" : result.error.message);
    });

    it("予期しない例外は 500 と汎用メッセージを返し、内部情報を含めない", async () => {
      doubles.registerBook.execute.mockRejectedValue(new Error('duplicate key value violates "book_pkey" password=secret'));

      const response = await sendJson(server.url("/book"), "POST", bookRequest);

      expect(await expectFailure(response)).toBe(INTERNAL_ERROR_MESSAGE);
      expect(consoleError).toHaveBeenCalled();
    });
  });

  describe("GET /book/{isbn}/recommendations", () => {
    it("推薦に成功すると 200 と推薦書籍名の配列を返す", async () => {
      doubles.recommendBooks.execute.mockResolvedValue(success({ recommendedBooks: ["書籍1", "書籍2"] }));

      const response = await fetch(server.url(`/book/${ISBN}/recommendations?threshold=0.8`));

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/^application\/json/);
      expect(await response.json()).toEqual({ ok: true, recommendedBooks: ["書籍1", "書籍2"] });
      expect(doubles.recommendBooks.execute).toHaveBeenCalledWith({ bookId: ISBN, threshold: 0.8 });
    });

    it("threshold を省略した場合は undefined を渡す（既定値の適用はユースケースが行う）", async () => {
      doubles.recommendBooks.execute.mockResolvedValue(success({ recommendedBooks: [] }));

      const response = await fetch(server.url(`/book/${ISBN}/recommendations`));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, recommendedBooks: [] });
      expect(doubles.recommendBooks.execute).toHaveBeenCalledWith({ bookId: ISBN, threshold: undefined });
    });

    it("ETag を付けない（条件付き GET は仕様外）", async () => {
      doubles.recommendBooks.execute.mockResolvedValue(success({ recommendedBooks: ["書籍1"] }));

      const response = await sendRaw(server.url(`/book/${ISBN}/recommendations`));

      expect(response.status).toBe(200);
      expect(response.headers.etag).toBeUndefined();
    });

    it.each([
      ["If-None-Match: *", { "If-None-Match": "*" }],
      // ETag を有効にしていた場合にこの応答へ付いていた値
      ["If-None-Match: 以前の ETag", { "If-None-Match": 'W/"2a-IBn0HQL21Ln2h2GKgjH2JpI6dy4"' }],
      ["If-Modified-Since", { "If-Modified-Since": new Date().toUTCString() }],
    ])("条件付きヘッダー（%s）があっても 304 ではなく 200 と JSON を返す", async (_label, headers) => {
      doubles.recommendBooks.execute.mockResolvedValue(success({ recommendedBooks: ["書籍1"] }));

      const response = await sendRaw(server.url(`/book/${ISBN}/recommendations`), { headers });

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ ok: true, recommendedBooks: ["書籍1"] });
    });

    it("HEAD には応答しない（仕様外。Express 既定の 404）", async () => {
      const response = await sendRaw(server.url(`/book/${ISBN}/recommendations`), { method: "HEAD" });

      expect(response.status).toBe(404);
      expect(doubles.recommendBooks.execute).not.toHaveBeenCalled();
    });

    it.each([["abc"], [""], ["0x1"], ["Infinity"], ["1e400"]])(
      "threshold が数値表記でない（%p）場合は 500 を返し、ユースケースを呼ばない",
      async (threshold) => {
        const response = await fetch(server.url(`/book/${ISBN}/recommendations?threshold=${threshold}`));

        expect(await expectFailure(response)).toBe("threshold は数値である必要があります。");
        expect(doubles.recommendBooks.execute).not.toHaveBeenCalled();
      },
    );

    it("threshold が複数指定された場合は 500 を返す", async () => {
      const response = await fetch(server.url(`/book/${ISBN}/recommendations?threshold=0.1&threshold=0.2`));

      expect(await expectFailure(response)).toBe("threshold は数値である必要があります。");
      expect(doubles.recommendBooks.execute).not.toHaveBeenCalled();
    });

    it("ユースケースが失敗（値域外など）した場合は 500 とその理由を返す", async () => {
      doubles.recommendBooks.execute.mockResolvedValue(
        failure("VALIDATION_ERROR", "Thresholdは0以上1以下である必要があります。"),
      );

      const response = await fetch(server.url(`/book/${ISBN}/recommendations?threshold=1.5`));

      expect(await expectFailure(response)).toBe("Thresholdは0以上1以下である必要があります。");
      expect(doubles.recommendBooks.execute).toHaveBeenCalledWith({ bookId: ISBN, threshold: 1.5 });
    });

    it("予期しない例外は 500 と汎用メッセージを返す", async () => {
      doubles.recommendBooks.execute.mockRejectedValue(new Error("connection refused"));

      const response = await fetch(server.url(`/book/${ISBN}/recommendations`));

      expect(await expectFailure(response)).toBe(INTERNAL_ERROR_MESSAGE);
    });
  });
});

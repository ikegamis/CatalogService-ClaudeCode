import { createApp } from "Presentation/Express/app";
import { createInMemoryContainer, resolveControllers } from "Presentation/Express/CompositionRoot";

import { expectFailure, sendJson, startServer, TestServer } from "./TestServer";

/**
 * composition root の組み立て確認。インメモリ実装で実際のユースケースまで接続し、
 * HTTP からの一連の操作が同じデータベースを共有して動くことを検証する（業務ロジックの詳細は各層のテストで扱う）。
 */
describe("CompositionRoot（インメモリ実装）", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startServer(createApp(resolveControllers(createInMemoryContainer())));
  });

  afterEach(async () => {
    await server.close();
  });

  it("書籍登録 → レビュー登録 → 推薦 → 更新 → 削除 を HTTP で実行できる", async () => {
    const target = { isbn: "9784000000000", title: "対象書籍", author: "著者A", price: 3000 };
    const created = await sendJson(server.url("/book"), "POST", target);
    expect(created.status).toBe(201);

    const comment = "『前提書籍』をおすすめします。とても分かりやすく、基礎から丁寧に説明されていました。";
    const reviewed = await sendJson(server.url("/review"), "POST", { bookId: target.isbn, rating: 5, comment });
    expect(reviewed.status).toBe(201);
    const { review } = (await reviewed.json()) as { review: { id: string; name: string } };
    expect(review.name).toBe("名無し");

    const recommended = await fetch(server.url(`/book/${target.isbn}/recommendations?threshold=0`));
    expect(recommended.status).toBe(200);
    expect(await recommended.json()).toEqual({ ok: true, recommendedBooks: ["前提書籍"] });

    const updated = await sendJson(server.url(`/review/${review.id}`), "PUT", {
      bookId: target.isbn,
      name: "山田",
      rating: 4,
      comment: null,
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toEqual({
      ok: true,
      review: { id: review.id, bookId: target.isbn, name: "山田", rating: 4, comment: null },
    });

    const deleted = await fetch(server.url(`/review/${review.id}`), { method: "DELETE" });
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ ok: true, message: `'${review.id}' は削除されました` });

    const deletedAgain = await fetch(server.url(`/review/${review.id}`), { method: "DELETE" });
    expect(await expectFailure(deletedAgain)).toBe(`レビューID '${review.id}' のレビューは登録されていません。`);
  });

  it("同じ書籍IDの二重登録は 500 と業務上の理由を返す", async () => {
    const book = { isbn: "9784000000001", title: "書籍", author: "著者", price: 1000 };
    await sendJson(server.url("/book"), "POST", book);

    const response = await sendJson(server.url("/book"), "POST", book);

    expect(await expectFailure(response)).toBe("書籍ID '9784000000001' は既に登録されています。");
  });

  it("コンテナごとにデータベースが分かれる（テスト間で状態を共有しない）", async () => {
    const response = await fetch(server.url("/book/9784000000001/recommendations"));

    expect(await response.json()).toEqual({ ok: true, recommendedBooks: [] });
  });
});

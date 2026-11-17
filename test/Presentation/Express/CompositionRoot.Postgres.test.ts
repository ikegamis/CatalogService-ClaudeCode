import { Pool } from "pg";

import { createApp } from "Presentation/Express/app";
import { createPostgresContainer, resolveControllers } from "Presentation/Express/CompositionRoot";

import { describeSql, setupTestDatabase, truncateAll } from "../../Infrastructure/SQL/TestDatabase";

import { expectFailure, sendJson, startServer, TestServer } from "./TestServer";

/**
 * 本番用の composition root（PostgreSQL 実装）の組み立て確認。
 * 統合テスト用データベース（開発用とは別。TestDatabase.ts）に接続し、HTTP からユースケース・リポジトリ・トランザクションまでが
 * 1つのプールを共有して動くことを検証する。HTTP 契約の詳細は各 Controller のテストで扱う。
 */
describeSql("CompositionRoot（PostgreSQL 実装）", () => {
  let pool: Pool;
  let server: TestServer;

  beforeAll(async () => {
    pool = await setupTestDatabase();
  });

  afterAll(async () => {
    await truncateAll(pool);
    await pool?.end();
  });

  beforeEach(async () => {
    await truncateAll(pool);
    server = await startServer(createApp(resolveControllers(createPostgresContainer(pool))));
  });

  afterEach(async () => {
    await server.close();
  });

  it("書籍登録 → レビュー登録 → 推薦 → 更新 → 削除 を HTTP で実行でき、結果が PostgreSQL に永続化される", async () => {
    const target = { isbn: "9784000000000", title: "対象書籍", author: "著者A", price: 3000 };
    expect((await sendJson(server.url("/book"), "POST", target)).status).toBe(201);

    const comment = "『前提書籍』をおすすめします。とても分かりやすく、基礎から丁寧に説明されていました。";
    const reviewed = await sendJson(server.url("/review"), "POST", { bookId: target.isbn, rating: 5, comment });
    expect(reviewed.status).toBe(201);
    const { review } = (await reviewed.json()) as { review: { id: string } };

    const recommended = await fetch(server.url(`/book/${target.isbn}/recommendations?threshold=0`));
    expect(await recommended.json()).toEqual({ ok: true, recommendedBooks: ["前提書籍"] });

    const updated = await sendJson(server.url(`/review/${review.id}`), "PUT", {
      bookId: target.isbn,
      name: "山田",
      rating: 4,
      comment: null,
    });
    expect(updated.status).toBe(200);
    const stored = await pool.query("SELECT name, rating, comment FROM review WHERE review_id = $1", [review.id]);
    expect(stored.rows).toEqual([{ name: "山田", rating: 4, comment: null }]);

    const deleted = await fetch(server.url(`/review/${review.id}`), { method: "DELETE" });
    expect(deleted.status).toBe(200);
    expect((await pool.query("SELECT 1 FROM review")).rowCount).toBe(0);
  });

  it("未登録の書籍へのレビュー登録は 500 と業務上の理由を返し、何も保存しない", async () => {
    const response = await sendJson(server.url("/review"), "POST", { bookId: "9784999999999", rating: 3 });

    expect(await expectFailure(response)).toBe("書籍ID '9784999999999' の書籍は登録されていません。");
    expect((await pool.query("SELECT 1 FROM review")).rowCount).toBe(0);
  });

  it("同じ書籍IDの登録が同時に来ても1件だけ 201 になり、もう片方は 500 と業務上の理由を返す", async () => {
    const book = { isbn: "9784000000001", title: "書籍", author: "著者", price: 1000 };

    const responses = await Promise.all([
      sendJson(server.url("/book"), "POST", book),
      sendJson(server.url("/book"), "POST", book),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 500]);
    const failed = responses.find((r) => r.status === 500);
    expect(await expectFailure(failed as Response)).toBe("書籍ID '9784000000001' は既に登録されています。");
    expect((await pool.query("SELECT 1 FROM book")).rowCount).toBe(1);
  });
});

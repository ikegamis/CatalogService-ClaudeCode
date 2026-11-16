import { readFile } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

import { BookId } from "Domain/Models/Book/BookId";
import { Threshold } from "Domain/Models/Review/Threshold";
import { BookRecommendationService } from "Domain/Services/BookRecommendationService";
import { PostgresBookRepository } from "Infrastructure/SQL/PostgresBookRepository";
import { PostgresDatabase } from "Infrastructure/SQL/PostgresDatabase";
import { PostgresReviewRepository } from "Infrastructure/SQL/PostgresReviewRepository";

import { describeSql, setupTestDatabase, truncateAll } from "./TestDatabase";

const TEST_DATA_FILE = path.join(__dirname, "../../../src/Infrastructure/SQL/test-data.sql");

/** test-data.sql の冒頭に書いた「確認方法」の期待値が、実際のデータで成り立つことを検証する。 */
describeSql("test-data.sql（手動テスト用データ）", () => {
  let pool: Pool;
  let books: PostgresBookRepository;
  let reviews: PostgresReviewRepository;
  let recommendation: BookRecommendationService;

  beforeAll(async () => {
    pool = await setupTestDatabase();
    await truncateAll(pool);
    const sql = await readFile(TEST_DATA_FILE, "utf8");
    await pool.query(sql);
    // 再実行しても失敗しない（ON CONFLICT DO NOTHING）
    await pool.query(sql);
    const database = new PostgresDatabase(pool);
    books = new PostgresBookRepository(database);
    reviews = new PostgresReviewRepository(database);
    recommendation = new BookRecommendationService(books, reviews);
  });

  afterAll(async () => {
    await truncateAll(pool);
    await pool?.end();
  });

  it("全行がドメインの不変条件を満たし、集約として再構成できる", async () => {
    const bookIds = (await pool.query<{ book_id: string }>("SELECT book_id FROM book")).rows.map((r) => r.book_id);
    const reviewBookIds = (await pool.query<{ book_id: string }>("SELECT DISTINCT book_id FROM review")).rows;

    expect(bookIds).toHaveLength(5);
    for (const id of bookIds) {
      expect(await books.findById(new BookId(id))).not.toBeNull();
    }
    const reconstructed = await Promise.all(reviewBookIds.map((r) => reviews.findAllByBookId(new BookId(r.book_id))));
    expect(reconstructed.flat()).toHaveLength(7);
  });

  it.each([
    ["9784000000001", Threshold.DEFAULT_VALUE, ["オブジェクト指向入門", "リファクタリング"]],
    // リファクタリングとテスト駆動開発は言及回数・言及レビュー数とも同じ。品質係数の高いレビュー（01）で先に言及された方が先
    ["9784000000001", 0, ["オブジェクト指向入門", "リファクタリング", "テスト駆動開発"]],
    ["9784000000001", 1, []],
    ["9784000000003", Threshold.DEFAULT_VALUE, []],
    ["9784999999999", Threshold.DEFAULT_VALUE, []],
  ])("書籍 %s・threshold %s の推薦結果は %j", async (bookId, threshold, expected) => {
    expect(await recommendation.recommend(new BookId(bookId), new Threshold(threshold))).toEqual(expected);
  });
});

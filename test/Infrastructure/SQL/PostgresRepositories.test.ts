import { DatabaseError, Pool } from "pg";

import { BookAlreadyExistsError } from "Domain/Models/Book/BookAlreadyExistsError";
import { BookId } from "Domain/Models/Book/BookId";
import { migrate } from "Infrastructure/SQL/migrations";
import { PostgresBookRepository } from "Infrastructure/SQL/PostgresBookRepository";
import { PostgresDatabase } from "Infrastructure/SQL/PostgresDatabase";
import { PostgresReviewRepository } from "Infrastructure/SQL/PostgresReviewRepository";
import { PostgresTransactionManager } from "Infrastructure/SQL/PostgresTransactionManager";

import { BOOK_ID_1, makeBook, makeReview } from "../Contract/Fixtures";
import { describeRepositoryContract } from "../Contract/RepositoryContract";

import { describeSql, setupTestDatabase, truncateAll } from "./TestDatabase";

describeSql("PostgreSQL 実装", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = await setupTestDatabase();
  });

  afterAll(async () => {
    await pool?.end();
  });

  describe("ポート契約", () => {
    describeRepositoryContract(async () => {
      await truncateAll(pool);
      const database = new PostgresDatabase(pool);
      return {
        bookRepository: new PostgresBookRepository(database),
        reviewRepository: new PostgresReviewRepository(database),
        transactionManager: new PostgresTransactionManager(database),
      };
    });
  });

  describe("SQL 実装に固有の振る舞い", () => {
    let database: PostgresDatabase;

    beforeEach(async () => {
      await truncateAll(pool);
      database = new PostgresDatabase(pool);
    });

    it("トランザクションの成功・失敗にかかわらず、使った接続をすべてプールに返す", async () => {
      const transactionManager = new PostgresTransactionManager(database);
      const repository = new PostgresBookRepository(database);
      await transactionManager.begin(() => repository.save(makeBook()));
      // 主キー違反（トランザクションが中断状態になる）
      await expect(transactionManager.begin(() => repository.save(makeBook()))).rejects.toBeInstanceOf(
        BookAlreadyExistsError,
      );
      await expect(transactionManager.begin(() => Promise.reject(new Error("失敗")))).rejects.toThrow("失敗");

      expect(pool.waitingCount).toBe(0);
      expect(pool.idleCount).toBe(pool.totalCount);
    });

    it("主キー違反以外のデータベースエラーは BookAlreadyExistsError に変換せず、そのまま投げる", async () => {
      const otherError = new DatabaseError("check violation", 0, "error");
      otherError.code = "23514";
      otherError.constraint = "book_price_range";
      const failingDatabase = { query: jest.fn().mockRejectedValue(otherError) };
      const repository = new PostgresBookRepository(failingDatabase as unknown as PostgresDatabase);

      await expect(repository.save(makeBook())).rejects.toBe(otherError);
    });

    it("schema.sql の再適用（migrate の再実行）で既存データは変わらない", async () => {
      await new PostgresBookRepository(database).save(makeBook());

      await migrate(pool);

      expect(await new PostgresBookRepository(database).findById(new BookId(BOOK_ID_1))).not.toBeNull();
    });

    it("rating・price は JavaScript の number として取得される（型変換で文字列にならない）", async () => {
      await new PostgresBookRepository(database).save(makeBook({ price: 1000000 }));
      await new PostgresReviewRepository(database).save(makeReview({ rating: 3 }));

      const book = await pool.query("SELECT price FROM book");
      const review = await pool.query("SELECT rating FROM review");

      expect(book.rows[0].price).toBe(1000000);
      expect(review.rows[0].rating).toBe(3);
    });
  });

  describe("DB 制約（ドメイン検証を迂回した書き込みに対する最後の防衛線）", () => {
    beforeEach(async () => {
      await truncateAll(pool);
    });

    const insertBook = (bookId: string, title: string, author: string, price: number) =>
      pool.query("INSERT INTO book (book_id, title, author, price) VALUES ($1, $2, $3, $4)", [bookId, title, author, price]);
    const insertReview = (reviewId: string, name: string, rating: number, comment: string | null) =>
      pool.query("INSERT INTO review (review_id, book_id, name, rating, comment) VALUES ($1, $2, $3, $4, $5)", [
        reviewId,
        BOOK_ID_1,
        name,
        rating,
        comment,
      ]);
    const VALID_REVIEW_ID = "01JD0000000000000000000001";

    it.each([
      ["price 0", () => insertBook(BOOK_ID_1, "T", "A", 0), "book_price_range"],
      ["price 1000001", () => insertBook(BOOK_ID_1, "T", "A", 1000001), "book_price_range"],
      ["空のタイトル", () => insertBook(BOOK_ID_1, "", "A", 1), "book_title_len"],
      ["空の著者", () => insertBook(BOOK_ID_1, "T", "", 1), "book_author_len"],
      ["rating 0", () => insertReview(VALID_REVIEW_ID, "名無し", 0, null), "review_rating_range"],
      ["rating 6", () => insertReview(VALID_REVIEW_ID, "名無し", 6, null), "review_rating_range"],
      ["空の投稿者名", () => insertReview(VALID_REVIEW_ID, "", 3, null), "review_name_len"],
      ["空のコメント", () => insertReview(VALID_REVIEW_ID, "名無し", 3, ""), "review_comment_len"],
      ["ULID でないレビューID", () => insertReview("0".repeat(25) + "I", "名無し", 3, null), "review_review_id_fmt"],
    ])("%s は CHECK 制約で拒否される", async (_label, insert, constraint) => {
      await expect(insert()).rejects.toMatchObject({ code: "23514", constraint });
    });

    it("上限を超える文字列は型の長さ制約で拒否される", async () => {
      await expect(insertBook(BOOK_ID_1, "T".repeat(1001), "A", 1)).rejects.toMatchObject({ code: "22001" });
      await expect(insertReview(VALID_REVIEW_ID, "名".repeat(51), 3, null)).rejects.toMatchObject({ code: "22001" });
    });

    it("必須項目の NULL は NOT NULL 制約で拒否される", async () => {
      await expect(
        pool.query("INSERT INTO review (review_id, book_id, name, rating) VALUES ($1, $2, NULL, 3)", [
          VALID_REVIEW_ID,
          BOOK_ID_1,
        ]),
      ).rejects.toMatchObject({ code: "23502" });
    });

    it("レビューは未登録の書籍IDでも保存できる（外部キーを張らない：UC-REVIEW-002 は書籍の存在を確認しない）", async () => {
      const repository = new PostgresReviewRepository(new PostgresDatabase(pool));
      await repository.save(makeReview());
      await repository.update(makeReview({ bookId: "9784999999999" }));

      expect((await repository.findAllByBookId(new BookId("9784999999999"))).length).toBe(1);
    });
  });
});

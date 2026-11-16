import { Author } from "Domain/Models/Book/Author";
import { Book } from "Domain/Models/Book/Book";
import { BookId } from "Domain/Models/Book/BookId";
import { Price } from "Domain/Models/Book/Price";
import { Title } from "Domain/Models/Book/Title";
import { Comment } from "Domain/Models/Review/Comment";
import { Rating } from "Domain/Models/Review/Rating";
import { Review } from "Domain/Models/Review/Review";
import { BookRecommendationService } from "Domain/Services/BookRecommendationService";
import { RecommendBooksService } from "Application/Services/Book/RecommendBooksService";

import { FakeBookRepository, FakeReviewRepository } from "../../TestDoubles/FakeRepositories";

const BOOK_ID = "9784000000000";
const bookId = new BookId(BOOK_ID);
const targetBook = new Book(bookId, new Title("対象の本"), new Author("著者"), new Price(3000));

/** 評価とコメントから、対象書籍へのレビューを作る。 */
const review = (rating: number, comment: string): Review =>
  Review.create(bookId, null, new Rating(rating), new Comment(comment));

/**
 * 信頼性スコア：評価5・コメント短 → 0.7 + 0.2*0.3 = 0.76、評価4・コメント短 → 0.525 + 0.06 = 0.585（四捨五入で 0.59）。
 * そのため既定の閾値 0.6 では評価5のみ、閾値 0.5 では両方が信頼できるレビューになる。
 */
const reviews = [
  review(5, "『本A』を読むと良い"),
  review(5, "『本A』を読むべき"),
  review(4, "『本B』を読む"),
  review(4, "『本B』を読む"),
  review(4, "『本B』を読む"),
];

const setup = (books: Book[] = [targetBook]) => {
  const bookRepository = new FakeBookRepository(null, books);
  const reviewRepository = new FakeReviewRepository(null, reviews);
  const service = new RecommendBooksService(new BookRecommendationService(bookRepository, reviewRepository));
  return { service, bookRepository, reviewRepository };
};

describe("RecommendBooksService（UC-CATALOG-001 書籍推薦）", () => {
  it("指定した閾値で信頼できるレビューから、言及頻度順の推薦書籍名を返す", async () => {
    const { service } = setup();

    const result = await service.execute({ bookId: BOOK_ID, threshold: 0.5 });

    expect(result).toEqual({ ok: true, data: { recommendedBooks: ["本B", "本A"] } });
  });

  it("閾値を省略した場合は既定値 0.6 を用いる", async () => {
    const { service } = setup();

    const result = await service.execute({ bookId: BOOK_ID });

    expect(result).toEqual({ ok: true, data: { recommendedBooks: ["本A"] } });
  });

  it.each([0, 1.0])("閾値の境界値 %s を受け付ける", async (threshold) => {
    const { service } = setup();

    const result = await service.execute({ bookId: BOOK_ID, threshold });

    expect(result.ok).toBe(true);
  });

  it("閾値 1.0 では信頼できるレビューがなく、空配列を返す", async () => {
    const { service } = setup();

    const result = await service.execute({ bookId: BOOK_ID, threshold: 1.0 });

    expect(result).toEqual({ ok: true, data: { recommendedBooks: [] } });
  });

  it("対象書籍が存在しない場合は成功とし、空配列を返す", async () => {
    const { service } = setup([]);

    const result = await service.execute({ bookId: BOOK_ID, threshold: 0.5 });

    expect(result).toEqual({ ok: true, data: { recommendedBooks: [] } });
  });

  it.each([
    ["閾値が負数", { bookId: BOOK_ID, threshold: -0.1 }],
    ["閾値が1.0超", { bookId: BOOK_ID, threshold: 1.1 }],
    ["閾値がNaN", { bookId: BOOK_ID, threshold: Number.NaN }],
    ["書籍IDが13文字でない", { bookId: "123" }],
  ])("入力が不正（%s）なら VALIDATION_ERROR を返し、リポジトリを呼ばない", async (_, query) => {
    const { service, bookRepository, reviewRepository } = setup();

    const result = await service.execute(query);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("VALIDATION_ERROR");
    expect(bookRepository.calls).toEqual([]);
    expect(reviewRepository.calls).toEqual([]);
  });

  it("レビューリポジトリが失敗したら例外を伝播する", async () => {
    const { service, reviewRepository } = setup();
    reviewRepository.failOn = "findAllByBookId";

    await expect(service.execute({ bookId: BOOK_ID })).rejects.toThrow("review repository findAllByBookId failed");
  });

  it("書籍リポジトリが失敗したら例外を伝播し、レビューを取得しない", async () => {
    const { service, bookRepository, reviewRepository } = setup();
    bookRepository.failOn = "findById";

    await expect(service.execute({ bookId: BOOK_ID })).rejects.toThrow("book repository findById failed");
    expect(reviewRepository.calls).toEqual([]);
  });

  it("閾値が数値でない（文字列）なら VALIDATION_ERROR を返す", async () => {
    const { service } = setup();

    const result = await service.execute({ bookId: BOOK_ID, threshold: "0.5" as unknown as number });

    expect(!result.ok && result.error.code).toBe("VALIDATION_ERROR");
  });
});

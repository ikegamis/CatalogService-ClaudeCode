import { Author } from "Domain/Models/Book/Author";
import { Book } from "Domain/Models/Book/Book";
import { BookId } from "Domain/Models/Book/BookId";
import { IBookRepository } from "Domain/Models/Book/IBookRepository";
import { Price } from "Domain/Models/Book/Price";
import { Title } from "Domain/Models/Book/Title";
import { Comment } from "Domain/Models/Review/Comment";
import { IReviewRepository } from "Domain/Models/Review/IReviewRepository";
import { Rating } from "Domain/Models/Review/Rating";
import { Review } from "Domain/Models/Review/Review";
import { ReviewId } from "Domain/Models/Review/ReviewId";
import { Threshold } from "Domain/Models/Review/Threshold";
import { BookRecommendationService } from "Domain/Services/BookRecommendationService";

const TARGET_BOOK_ID = new BookId("9784000000000");
const OTHER_BOOK_ID = new BookId("9784000000001");
const TARGET_TITLE = "対象の本";
const DEFAULT_THRESHOLD = new Threshold(0.6);

/** 書籍リポジトリのテストダブル。 */
class StubBookRepository implements IBookRepository {
  constructor(private readonly books: Book[]) {}

  async save(): Promise<void> {}

  async findById(bookId: BookId): Promise<Book | null> {
    return this.books.find((book) => book.bookId.equals(bookId)) ?? null;
  }
}

/** レビューリポジトリのテストダブル。findAllByBookId は登録順に返す。 */
class StubReviewRepository implements IReviewRepository {
  findAllByBookIdCalls = 0;

  constructor(private readonly reviews: Review[]) {}

  async save(): Promise<void> {}

  async update(): Promise<void> {}

  async delete(): Promise<void> {}

  async findById(reviewId: ReviewId): Promise<Review | null> {
    return this.reviews.find((review) => review.reviewId.equals(reviewId)) ?? null;
  }

  async findAllByBookId(bookId: BookId): Promise<Review[]> {
    this.findAllByBookIdCalls += 1;
    return this.reviews.filter((review) => review.bookId.equals(bookId));
  }
}

const targetBook = new Book(TARGET_BOOK_ID, new Title(TARGET_TITLE), new Author("著者"), new Price(3000));

/**
 * テスト用のレビューを作る。
 * 評価5なら、コメントの長さにかかわらず信頼性スコアは 0.7 以上（既定の閾値で信頼できる）。
 * コメントの品質係数は「推薦文 + 埋め草」の長さで調整する。
 */
const review = (comment: string | null, options: { rating?: number; bookId?: BookId } = {}): Review =>
  Review.create(
    options.bookId ?? TARGET_BOOK_ID,
    null,
    new Rating(options.rating ?? 5),
    comment === null ? null : new Comment(comment),
  );

/** 指定の長さになるまで末尾を埋めたコメント（品質係数を調整するため）。 */
const padded = (text: string, length: number): string => text + "。".repeat(length - text.length);

const createService = (reviews: Review[], books: Book[] = [targetBook]) => {
  const reviewRepository = new StubReviewRepository(reviews);
  return {
    service: new BookRecommendationService(new StubBookRepository(books), reviewRepository),
    reviewRepository,
  };
};

describe("BookRecommendationService", () => {
  describe("対象書籍とレビューの取得", () => {
    it("対象書籍が存在しない場合は空配列を返す", async () => {
      const { service, reviewRepository } = createService([review("『本A』を読む")], []);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual([]);
      expect(reviewRepository.findAllByBookIdCalls).toBe(0);
    });

    it("対象書籍に紐づくレビューがない場合は空配列を返す", async () => {
      const { service } = createService([]);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual([]);
    });

    it("対象書籍に紐づくレビューだけを集計に使う", async () => {
      const { service } = createService([
        review("『本A』を読む"),
        review("『本B』を読む", { bookId: OTHER_BOOK_ID }),
      ]);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual(["本A"]);
    });

    it("前提書籍が抽出できない場合は空配列を返す", async () => {
      const { service } = createService([review("前提書籍の言及なし")]);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual([]);
    });
  });

  describe("信頼できるレビューの絞り込み", () => {
    it("信頼性スコアが閾値未満のレビューは集計に使わない", async () => {
      // 評価1・短いコメント: スコア 0.06
      const { service } = createService([
        review("『本A』を読む", { rating: 1 }),
        review("『本B』を読む", { rating: 5 }),
      ]);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual(["本B"]);
    });

    it("信頼できるレビューが0件の場合は空配列を返す", async () => {
      const { service } = createService([review("『本A』を読む", { rating: 1 })]);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual([]);
    });

    it("閾値と信頼性スコアが等しいレビューは集計に使う（境界）", async () => {
      // 評価4・100文字: スコア 0.83
      const target = review(padded("『本A』を読む", 100), { rating: 4 });
      const { service } = createService([target]);

      expect(await service.recommend(TARGET_BOOK_ID, new Threshold(0.83))).toEqual(["本A"]);
    });
  });

  describe("言及頻度の集計", () => {
    it("言及頻度（出現回数）の多い順に書籍名を返す", async () => {
      const { service } = createService([
        review("『本A』を読む"),
        review("『本B』を読む"),
        review("『本B』を読む"),
      ]);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual(["本B", "本A"]);
    });

    it("同一コメント内で同じ書籍名が複数回出現した場合も出現ごとに数える", async () => {
      const { service } = createService([
        review("『本A』を読む"),
        review("『本A』を読む"),
        review("『本B』を読む。『本B』が必要。『本B』がいい"),
      ]);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual(["本B", "本A"]);
    });

    it("前後空白だけが異なる書籍名は同じ書籍として数え、前後空白を除いた書籍名を返す", async () => {
      const { service } = createService([
        review("『本A』を読む"),
        review("『 本A 』を読む"),
        review("『本B』を読む"),
      ]);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual(["本A", "本B"]);
    });

    it("同じ書籍名は1件にまとめて返す", async () => {
      const { service } = createService([review("『本A』を読む"), review("『本A』を読む")]);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual(["本A"]);
    });
  });

  describe("対象書籍自身の除外", () => {
    it("対象書籍のタイトルと一致する書籍名は推薦結果から除外する", async () => {
      const { service } = createService([review(`『${TARGET_TITLE}』を読む。『本A』も読む`)]);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual(["本A"]);
    });

    it("前後空白を除いて一致すれば対象書籍自身とみなす", async () => {
      const book = new Book(TARGET_BOOK_ID, new Title(` ${TARGET_TITLE}\u3000`), new Author("著者"), new Price(3000));
      const { service } = createService([review(`『 ${TARGET_TITLE} 』を読む。『本A』も読む`)], [book]);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual(["本A"]);
    });

    it("途中の文字が異なる書籍名は除外しない", async () => {
      const { service } = createService([review(`『${TARGET_TITLE}2』を読む`)]);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual([`${TARGET_TITLE}2`]);
    });
  });

  describe("言及頻度が同数の場合の並び順", () => {
    it("言及した信頼できるレビューの数が多い書籍を先にする", async () => {
      // 本A: 1レビューで2回、本B: 2レビューで各1回 → 頻度はどちらも2
      const { service } = createService([
        review(padded("『本A』を読む。『本A』が必要", 100)),
        review("『本B』を読む"),
        review("『本B』を読む"),
      ]);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual(["本B", "本A"]);
    });

    it("レビュー数も同数なら、品質係数の高いレビューで先に言及された書籍を先にする", async () => {
      // 取得順は本A（短いコメント）→ 本B（100文字）だが、品質係数の降順で本Bのレビューが先になる
      const { service } = createService([review("『本A』を読む"), review(padded("『本B』を読む", 100))]);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual(["本B", "本A"]);
    });

    it("同じレビュー内ではコメント内で先に現れた書籍名を先にする", async () => {
      const { service } = createService([review("『本B』を読む。『本A』を読む")]);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual(["本B", "本A"]);
    });

    it("品質係数も同じレビュー同士は取得順を保つ", async () => {
      const { service } = createService([review("『本A』を読む"), review("『本B』を読む")]);

      expect(await service.recommend(TARGET_BOOK_ID, DEFAULT_THRESHOLD)).toEqual(["本A", "本B"]);
    });
  });
});

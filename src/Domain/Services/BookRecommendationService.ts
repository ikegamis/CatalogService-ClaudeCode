import { BookId } from "Domain/Models/Book/BookId";
import { IBookRepository } from "Domain/Models/Book/IBookRepository";
import { IReviewRepository } from "Domain/Models/Review/IReviewRepository";
import { Review } from "Domain/Models/Review/Review";

/** 推薦候補の書籍名ごとの集計結果。 */
type MentionStat = {
  /** 言及頻度（信頼できるレビュー全体での出現回数）。 */
  count: number;
  /** その書籍名に言及した信頼できるレビュー。 */
  reviews: Set<Review>;
  /** 最初に言及された順位（品質係数ソート後のレビュー順 → コメント内の出現順）。 */
  firstMentionOrder: number;
};

/**
 * 書籍推薦ドメインサービス（doc/domain/services/BookRecommendationService.md）。
 * 対象書籍に紐づくレビューの取得と、複数レビューを横断する前提書籍の言及頻度の集計を担う。
 * 個々のレビューの信頼性判定・前提書籍抽出は Review 集約に委譲する。
 */
export class BookRecommendationService {
  constructor(
    private readonly bookRepository: IBookRepository,
    private readonly reviewRepository: IReviewRepository,
  ) {}

  /**
   * 対象書籍の信頼できるレビューから前提書籍名を抽出し、推薦順に並べて返す。
   * 対象書籍が存在しない場合は空配列を返す。threshold が 0〜1.0 の範囲外なら DomainValidationError とする。
   */
  async recommend(bookId: BookId, threshold: number): Promise<string[]> {
    // 取得結果に関わらず不正な threshold をエラーにするため、取得より前に検証する
    Review.assertValidThreshold(threshold);

    const book = await this.bookRepository.findById(bookId);
    if (book === null) {
      return [];
    }
    const targetTitle = book.title.value.trim();

    const reviews = await this.reviewRepository.findAllByBookId(bookId);
    const trustedReviews = reviews
      .filter((review) => review.isTrustworthy(threshold))
      // Array.prototype.sort は安定ソートのため、品質係数が同じレビューは取得順を保つ
      .sort((a, b) => qualityFactorOf(b) - qualityFactorOf(a));

    const stats = new Map<string, MentionStat>();
    for (const review of trustedReviews) {
      for (const title of review.extractRecommendedBooks()) {
        if (title.trim() === targetTitle) {
          continue;
        }
        const stat = stats.get(title);
        if (stat === undefined) {
          stats.set(title, { count: 1, reviews: new Set([review]), firstMentionOrder: stats.size });
        } else {
          stat.count += 1;
          stat.reviews.add(review);
        }
      }
    }

    return Array.from(stats.entries())
      .sort(
        ([, a], [, b]) =>
          b.count - a.count ||
          b.reviews.size - a.reviews.size ||
          a.firstMentionOrder - b.firstMentionOrder,
      )
      .map(([title]) => title);
  }
}

/** レビューの並べ替えに用いる品質係数。コメントがあればコメントの、なければ評価の品質係数とする。 */
const qualityFactorOf = (review: Review): number =>
  review.comment === null ? review.rating.getQualityFactor() : review.comment.getQualityFactor();

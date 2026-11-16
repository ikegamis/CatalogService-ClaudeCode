import { BookId } from "Domain/Models/Book/BookId";
import { Threshold } from "Domain/Models/Review/Threshold";
import { BookRecommendationService } from "Domain/Services/BookRecommendationService";
import { parseInput, success, UseCaseResult } from "Application/Shared/UseCaseResult";

export type RecommendBooksQuery = {
  /** 対象書籍の書籍ID（ISBN）。 */
  bookId: string;
  /** レビュー信頼性の閾値（0 以上 1.0 以下）。省略時は Threshold の既定値 0.6 を用いる。 */
  threshold?: number;
};

export type RecommendBooksDto = {
  /** 言及頻度順の推薦書籍名。 */
  recommendedBooks: string[];
};

/**
 * UC-CATALOG-001 書籍推薦。
 * 取得・信頼性判定・集計・並べ替えはドメインサービスに委譲する。
 * 参照のみで更新を伴わないため、トランザクションは開始しない。
 */
export class RecommendBooksService {
  constructor(private readonly bookRecommendationService: BookRecommendationService) {}

  async execute(query: RecommendBooksQuery): Promise<UseCaseResult<RecommendBooksDto>> {
    const parsed = parseInput(() => ({
      bookId: new BookId(query.bookId),
      threshold: query.threshold === undefined ? Threshold.default() : new Threshold(query.threshold),
    }));
    if (!parsed.ok) {
      return parsed;
    }

    const recommendedBooks = await this.bookRecommendationService.recommend(
      parsed.data.bookId,
      parsed.data.threshold,
    );
    return success({ recommendedBooks });
  }
}

import { BookId } from "Domain/Models/Book/BookId";

import { Comment } from "./Comment";
import { Name } from "./Name";
import { Rating } from "./Rating";
import { ReviewId } from "./ReviewId";

/** 前提書籍とみなすための推薦キーワード。 */
const RECOMMENDATION_KEYWORDS = [
  "読む",
  "読んだ",
  "学ぶ",
  "学んだ",
  "必要",
  "推奨",
  "おすすめ",
  "良い",
  "いい",
  "理解",
] as const;

/** 『』の直後からこの文字数以内に推薦キーワード全体が含まれていれば前提書籍とみなす。 */
const KEYWORD_WINDOW_LENGTH = 30;

/**
 * 『書籍名』の直後 KEYWORD_WINDOW_LENGTH 文字以内に推薦キーワードが完全に収まるものに一致する正規表現。
 * キーワードごとに長さが異なるため、キーワードの終端が窓内に収まるよう先行文字数をキーワードごとに調整する。
 * 先読みを使うため、窓内の文字は消費されず、後続の『』も独立に判定される。
 */
const RECOMMENDED_BOOK_PATTERN = new RegExp(
  `『[^『』]+』(?=${RECOMMENDATION_KEYWORDS.map(
    (keyword) => `[\\s\\S]{0,${KEYWORD_WINDOW_LENGTH - keyword.length}}${keyword}`,
  ).join("|")})`,
  "g",
);

const RATING_WEIGHT = 0.7;
const COMMENT_WEIGHT = 0.3;
const DEFAULT_TRUST_THRESHOLD = 0.6;

/**
 * レビュー集約の集約ルート。
 * Book 集約は BookId でのみ参照する。Name が null の場合は匿名投稿、Comment が null の場合はコメントなしを表す。
 * 複数レビューを横断する取得・集計は持たず、個々のレビューの振る舞いのみを提供する。
 */
export class Review {
  private _name: Name | null;
  private _comment: Comment | null;

  constructor(
    private readonly _reviewId: ReviewId,
    private readonly _bookId: BookId,
    name: Name | null,
    private readonly _rating: Rating,
    comment: Comment | null,
  ) {
    this._name = name;
    this._comment = comment;
  }

  /** ReviewId を新規に生成してレビューを作成する。 */
  static create(bookId: BookId, name: Name | null, rating: Rating, comment: Comment | null): Review {
    return new Review(ReviewId.generate(), bookId, name, rating, comment);
  }

  get reviewId(): ReviewId {
    return this._reviewId;
  }

  get bookId(): BookId {
    return this._bookId;
  }

  get name(): Name | null {
    return this._name;
  }

  get rating(): Rating {
    return this._rating;
  }

  get comment(): Comment | null {
    return this._comment;
  }

  /** 投稿者名を変更する。 */
  updateName(name: Name): void {
    this._name = name;
  }

  /** コメントを登録する。既存のコメントは上書きされる。 */
  editComment(comment: Comment): void {
    this._comment = comment;
  }

  /**
   * コメントから前提書籍のタイトルを抽出する。
   * 同一コメント内で同じタイトルが複数回現れても1件として扱い、初出順に返す。
   */
  extractRecommendedBooks(): string[] {
    if (this._comment === null) {
      return [];
    }
    const titles = this._comment
      .extractMatches(RECOMMENDED_BOOK_PATTERN)
      .map((match) => match.slice(1, -1));
    return titles.filter((title, index) => titles.indexOf(title) === index);
  }

  /** 信頼性スコアが threshold 以上なら信頼できるレビューとみなす。 */
  isTrustworthy(threshold: number = DEFAULT_TRUST_THRESHOLD): boolean {
    return this.calculateReliability() >= threshold;
  }

  /** 評価とコメントの品質係数を重み付けで合成した信頼性スコアを返す。コメントがない場合のコメント品質係数は 0 とする。 */
  calculateReliability(): number {
    const commentQuality = this._comment === null ? 0 : this._comment.getQualityFactor();
    return this._rating.getQualityFactor() * RATING_WEIGHT + commentQuality * COMMENT_WEIGHT;
  }
}

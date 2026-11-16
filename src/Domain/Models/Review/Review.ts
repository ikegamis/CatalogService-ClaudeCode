import { BookId } from "Domain/Models/Book/BookId";

import { Comment } from "./Comment";
import { Name } from "./Name";
import { Rating } from "./Rating";
import { ReviewId } from "./ReviewId";
import { Threshold } from "./Threshold";

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
/** 信頼性スコアを丸める小数点以下の桁数。 */
const RELIABILITY_DECIMAL_PLACES = 2;

/**
 * レビュー集約の集約ルート。
 * Book 集約は BookId でのみ参照する。Comment が null の場合はコメントなしを表す。
 * 投稿者名は常に存在し、匿名投稿では既定値「名無し」を用いる。
 * 複数レビューを横断する取得・集計は持たず、個々のレビューの振る舞いのみを提供する。
 */
export class Review {
  private _name: Name;
  private _comment: Comment | null;

  /** 既存のレビューを再構成する。 */
  constructor(
    private readonly _reviewId: ReviewId,
    private readonly _bookId: BookId,
    name: Name,
    private readonly _rating: Rating,
    comment: Comment | null,
  ) {
    this._name = name;
    this._comment = comment;
  }

  /**
   * ReviewId を新規に生成してレビューを作成する。
   * 投稿者名が省略された場合（null）は匿名投稿とし、既定値「名無し」を投稿者名とする。
   */
  static create(bookId: BookId, name: Name | null, rating: Rating, comment: Comment | null): Review {
    return new Review(ReviewId.generate(), bookId, name ?? Name.anonymous(), rating, comment);
  }

  get reviewId(): ReviewId {
    return this._reviewId;
  }

  get bookId(): BookId {
    return this._bookId;
  }

  get name(): Name {
    return this._name;
  }

  get rating(): Rating {
    return this._rating;
  }

  get comment(): Comment | null {
    return this._comment;
  }

  /** レビューの同一性は ReviewId の値で判定する。 */
  equals(other: Review): boolean {
    return this._reviewId.equals(other._reviewId);
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
   * コメントから前提書籍のタイトルを出現順に抽出する。
   * 同一コメント内で同じタイトルが複数回現れた場合も、出現ごとに含める（言及頻度の集計で出現回数を数えるため）。
   */
  extractRecommendedBooks(): string[] {
    if (this._comment === null) {
      return [];
    }
    return this._comment
      .extractMatches(RECOMMENDED_BOOK_PATTERN)
      .map((match) => match.slice(1, -1));
  }

  /** 信頼性スコアが threshold 以上なら信頼できるレビューとみなす。threshold を省略した場合は既定値 0.6 を用いる。 */
  isTrustworthy(threshold: Threshold = Threshold.default()): boolean {
    return this.calculateReliability() >= threshold.value;
  }

  /**
   * 評価とコメントの品質係数を重み付けで合成した信頼性スコアを、小数点以下2桁に四捨五入して返す。
   * コメントがない場合のコメント品質係数は 0 とする。
   * 丸めるのは、浮動小数点の誤差（例：0.65 が 0.6499999999999999 になる）で閾値との比較結果が変わらないようにするため。
   */
  calculateReliability(): number {
    const commentQuality = this._comment === null ? 0 : this._comment.getQualityFactor();
    const score = this._rating.getQualityFactor() * RATING_WEIGHT + commentQuality * COMMENT_WEIGHT;
    return roundHalfUp(score, RELIABILITY_DECIMAL_PLACES);
  }
}

/**
 * 小数点以下 places 桁に四捨五入する。
 * 2進数で表せない値（例：0.585 は内部的に 0.58499999...）が切り捨て側に丸まらないよう、Number.EPSILON を加えてから丸める。
 */
const roundHalfUp = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

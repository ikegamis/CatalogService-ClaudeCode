import { BookId } from "Domain/Models/Book/BookId";
import { Comment } from "Domain/Models/Review/Comment";
import { Name } from "Domain/Models/Review/Name";
import { Rating } from "Domain/Models/Review/Rating";
import { Review } from "Domain/Models/Review/Review";
import { ReviewId } from "Domain/Models/Review/ReviewId";
import { Threshold } from "Domain/Models/Review/Threshold";

const BOOK_ID = "9784000000000";
const REVIEW_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

const createReview = (options: { rating?: number; comment?: string | null } = {}): Review =>
  new Review(
    new ReviewId(REVIEW_ID),
    new BookId(BOOK_ID),
    new Name("山田太郎"),
    new Rating(options.rating ?? 3),
    options.comment === null ? null : new Comment(options.comment ?? "良い本でした"),
  );

const reviewWithComment = (comment: string): Review => createReview({ comment });

describe("Review", () => {
  describe("生成", () => {
    it("識別子・書籍識別子・投稿者名・評価・コメントを指定してレビューを再構成できる", () => {
      const review = createReview({ rating: 4, comment: "とても良い" });

      expect(review.reviewId.value).toBe(REVIEW_ID);
      expect(review.bookId.equals(new BookId(BOOK_ID))).toBe(true);
      expect(review.name.value).toBe("山田太郎");
      expect(review.rating.value).toBe(4);
      expect(review.comment?.value).toBe("とても良い");
    });

    it("新規作成時はULIDのレビュー識別子が自動生成される", () => {
      const review = Review.create(new BookId(BOOK_ID), new Name("山田太郎"), new Rating(5), null);

      expect(review.reviewId.value).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
    });

    it("新規作成するたびに異なるレビュー識別子が割り当てられる", () => {
      const a = Review.create(new BookId(BOOK_ID), null, new Rating(5), null);
      const b = Review.create(new BookId(BOOK_ID), null, new Rating(5), null);

      expect(a.reviewId.equals(b.reviewId)).toBe(false);
    });

    it("投稿者名を省略すると匿名投稿として既定値「名無し」が投稿者名になる", () => {
      const review = Review.create(new BookId(BOOK_ID), null, new Rating(3), new Comment("普通"));

      expect(review.name.value).toBe("名無し");
    });

    it("コメントなしでレビューを作成できる", () => {
      const review = Review.create(new BookId(BOOK_ID), new Name("山田太郎"), new Rating(3), null);

      expect(review.comment).toBeNull();
    });

    it("同じ書籍に対して複数のレビューを作成できる", () => {
      const a = Review.create(new BookId(BOOK_ID), null, new Rating(1), null);
      const b = Review.create(new BookId(BOOK_ID), null, new Rating(5), null);

      expect(a.bookId.equals(b.bookId)).toBe(true);
    });
  });

  describe("同一性", () => {
    it("レビュー識別子が同じなら他の属性が異なっても同一のレビューとみなす", () => {
      const a = new Review(new ReviewId(REVIEW_ID), new BookId(BOOK_ID), new Name("山田太郎"), new Rating(1), null);
      const b = new Review(
        new ReviewId(REVIEW_ID),
        new BookId("9784000000001"),
        new Name("鈴木花子"),
        new Rating(5),
        new Comment("別のコメント"),
      );

      expect(a.equals(b)).toBe(true);
    });

    it("レビュー識別子が異なれば他の属性が同じでも別のレビューとみなす", () => {
      const a = Review.create(new BookId(BOOK_ID), new Name("山田太郎"), new Rating(3), new Comment("同じ"));
      const b = Review.create(new BookId(BOOK_ID), new Name("山田太郎"), new Rating(3), new Comment("同じ"));

      expect(a.equals(b)).toBe(false);
    });

    it("状態を変更しても同一のレビューのままである", () => {
      const review = createReview();
      const reconstructed = createReview();

      review.updateName(new Name("鈴木花子"));
      review.editComment(new Comment("編集後"));

      expect(review.equals(reconstructed)).toBe(true);
    });
  });

  describe("投稿者名の変更", () => {
    it("投稿者名を変更できる", () => {
      const review = createReview();

      review.updateName(new Name("鈴木花子"));

      expect(review.name.value).toBe("鈴木花子");
    });

    it("匿名のレビューの投稿者名を変更できる", () => {
      const review = Review.create(new BookId(BOOK_ID), null, new Rating(3), null);

      review.updateName(new Name("鈴木花子"));

      expect(review.name.value).toBe("鈴木花子");
    });

    it("投稿者名を変更しても他の属性は変わらない", () => {
      const review = createReview({ rating: 4, comment: "とても良い" });

      review.updateName(new Name("鈴木花子"));

      expect(review.reviewId.value).toBe(REVIEW_ID);
      expect(review.bookId.value).toBe(BOOK_ID);
      expect(review.rating.value).toBe(4);
      expect(review.comment?.value).toBe("とても良い");
    });
  });

  describe("コメントの編集", () => {
    it("既存のコメントは上書きされる", () => {
      const review = createReview({ comment: "最初のコメント" });

      review.editComment(new Comment("編集後のコメント"));

      expect(review.comment?.value).toBe("編集後のコメント");
    });

    it("コメントのないレビューにコメントを登録できる", () => {
      const review = createReview({ comment: null });

      review.editComment(new Comment("新しいコメント"));

      expect(review.comment?.value).toBe("新しいコメント");
    });

    it("コメントを編集しても他の属性は変わらない", () => {
      const review = createReview({ rating: 4 });

      review.editComment(new Comment("編集後"));

      expect(review.reviewId.value).toBe(REVIEW_ID);
      expect(review.bookId.value).toBe(BOOK_ID);
      expect(review.name.value).toBe("山田太郎");
      expect(review.rating.value).toBe(4);
    });

    it("コメントを編集すると信頼性スコアに反映される", () => {
      const review = createReview({ rating: 5, comment: "短い" });
      const before = review.calculateReliability();

      review.editComment(new Comment("a".repeat(100)));

      expect(review.calculateReliability()).toBeGreaterThan(before);
    });
  });

  describe("前提書籍の抽出", () => {
    it("『』で囲まれ直後に推薦キーワードがある書籍名を前提書籍として抽出する", () => {
      const review = reviewWithComment("先に『入門TypeScript』を読むと理解しやすい。");

      expect(review.extractRecommendedBooks()).toEqual(["入門TypeScript"]);
    });

    it.each(["読む", "読んだ", "学ぶ", "学んだ", "必要", "推奨", "おすすめ", "良い", "いい", "理解"])(
      "推薦キーワード「%s」で前提書籍とみなす",
      (keyword) => {
        expect(reviewWithComment(`『本A』${keyword}`).extractRecommendedBooks()).toEqual(["本A"]);
      },
    );

    it("推薦キーワードがない『』の書籍名は抽出しない", () => {
      const review = reviewWithComment("『本A』という本もある。");

      expect(review.extractRecommendedBooks()).toEqual([]);
    });

    it("推薦キーワードが『』より前にしかない場合は抽出しない", () => {
      const review = reviewWithComment("おすすめは『本A』です。");

      expect(review.extractRecommendedBooks()).toEqual([]);
    });

    it("『』の直後30文字以内にキーワード全体が収まれば抽出する（境界）", () => {
      // 『』の直後に28文字 + 「必要」(2文字) = 30文字
      const review = reviewWithComment(`『本A』${"x".repeat(28)}必要`);

      expect(review.extractRecommendedBooks()).toEqual(["本A"]);
    });

    it("キーワードが30文字の範囲をはみ出す場合は抽出しない（境界）", () => {
      // 『』の直後に29文字 + 「必要」(2文字) = 31文字
      const review = reviewWithComment(`『本A』${"x".repeat(29)}必要`);

      expect(review.extractRecommendedBooks()).toEqual([]);
    });

    it("長さの異なるキーワードでも30文字以内に収まるかで判定する", () => {
      // 『』の直後に26文字 + 「おすすめ」(4文字) = 30文字
      expect(reviewWithComment(`『本A』${"x".repeat(26)}おすすめ`).extractRecommendedBooks()).toEqual(["本A"]);
      // 『』の直後に27文字 + 「おすすめ」(4文字) = 31文字
      expect(reviewWithComment(`『本A』${"x".repeat(27)}おすすめ`).extractRecommendedBooks()).toEqual([]);
    });

    it("改行をまたいでも30文字以内のキーワードを検出する", () => {
      const review = reviewWithComment("『本A』\nは読むべき。");

      expect(review.extractRecommendedBooks()).toEqual(["本A"]);
    });

    it("複数の前提書籍を出現順に抽出する", () => {
      const review = reviewWithComment("『本A』を読んだ後に『本B』で学ぶと良い。");

      expect(review.extractRecommendedBooks()).toEqual(["本A", "本B"]);
    });

    it("後続の『』の範囲にあるキーワードも直前の書籍の判定に使われる", () => {
      // 『本A』の直後30文字以内に『本B』とキーワード「必要」の両方が含まれる
      const review = reviewWithComment("『本A』と『本B』が必要。");

      expect(review.extractRecommendedBooks()).toEqual(["本A", "本B"]);
    });

    it("条件を満たすものだけを抽出する", () => {
      const review = reviewWithComment(
        `『本A』は${"x".repeat(30)}関係ない。『本B』を読むと良い。`,
      );

      expect(review.extractRecommendedBooks()).toEqual(["本B"]);
    });

    it("同一コメント内で同じ書籍名が複数回出現した場合は出現ごとに抽出する", () => {
      const review = reviewWithComment("『本A』を読むべき。『本B』も良い。やはり『本A』が必要。");

      expect(review.extractRecommendedBooks()).toEqual(["本A", "本B", "本A"]);
    });

    it("空の『』は書籍名として抽出しない", () => {
      const review = reviewWithComment("『』を読む");

      expect(review.extractRecommendedBooks()).toEqual([]);
    });

    it("コメントがない場合は空配列を返す", () => {
      expect(createReview({ comment: null }).extractRecommendedBooks()).toEqual([]);
    });
  });

  describe("信頼性スコア", () => {
    it("評価の品質係数×0.7 とコメントの品質係数×0.3 の和を小数点以下2桁に四捨五入して返す", () => {
      // 評価4: 0.75, 100文字: 1.0 → 0.525 + 0.3 = 0.825 → 0.83
      const review = createReview({ rating: 4, comment: "a".repeat(100) });

      expect(review.calculateReliability()).toBe(0.83);
    });

    it("小数点以下3桁目が5以上なら切り上げる", () => {
      // 評価2・55文字: 0.25×0.7 + 0.6×0.3 = 0.355 → 0.36
      expect(createReview({ rating: 2, comment: "a".repeat(55) }).calculateReliability()).toBe(0.36);
      // 評価5・20文字: 0.7 + (0.2 + 10/90×0.8)×0.3 = 0.78666… → 0.79
      expect(createReview({ rating: 5, comment: "a".repeat(20) }).calculateReliability()).toBe(0.79);
    });

    it("小数点以下3桁目が5未満なら切り捨てる", () => {
      // 評価5・11文字: 0.7 + (0.2 + 1/90×0.8)×0.3 = 0.76266… → 0.76
      expect(createReview({ rating: 5, comment: "a".repeat(11) }).calculateReliability()).toBe(0.76);
    });

    it("2進数で表せない値でも四捨五入の結果が誤差で切り捨て側にずれない", () => {
      // 評価4・9文字: 0.525 + 0.06 = 0.585 → 0.59
      expect(createReview({ rating: 4, comment: "a".repeat(9) }).calculateReliability()).toBe(0.59);
      // 評価4・コメントなし: 0.525 → 0.53（丸め前は 0.5249999999999999）
      expect(createReview({ rating: 4, comment: null }).calculateReliability()).toBe(0.53);
    });

    it("最高評価かつ十分な長さのコメントでは 1.0 になる", () => {
      expect(createReview({ rating: 5, comment: "a".repeat(100) }).calculateReliability()).toBe(1);
    });

    it("最低評価かつ短いコメントでは 0.06 になる", () => {
      // 評価1: 0.0, 9文字: 0.2 → 0 + 0.06
      expect(createReview({ rating: 1, comment: "a".repeat(9) }).calculateReliability()).toBe(0.06);
    });

    it("コメントがない場合はコメントの品質係数を0として計算する", () => {
      // 評価5: 1.0 → 0.7 + 0
      expect(createReview({ rating: 5, comment: null }).calculateReliability()).toBe(0.7);
    });

    it("コメントがなく最低評価の場合は 0 になる", () => {
      expect(createReview({ rating: 1, comment: null }).calculateReliability()).toBe(0);
    });
  });

  describe("信頼性の判定", () => {
    it("信頼性スコアが閾値以上なら信頼できる", () => {
      // スコア 0.83
      expect(createReview({ rating: 4, comment: "a".repeat(100) }).isTrustworthy(new Threshold(0.8))).toBe(true);
    });

    it("信頼性スコアが閾値未満なら信頼できない", () => {
      // スコア 0.83
      expect(createReview({ rating: 4, comment: "a".repeat(100) }).isTrustworthy(new Threshold(0.9))).toBe(false);
    });

    it("信頼性スコアが閾値と等しい場合は信頼できる（境界）", () => {
      // 評価5・コメントなし: スコア 0.7
      expect(createReview({ rating: 5, comment: null }).isTrustworthy(new Threshold(0.7))).toBe(true);
    });

    describe("閾値を省略した場合は 0.6 を用いる", () => {
      it("スコア 0.7 のレビューは信頼できる", () => {
        expect(createReview({ rating: 5, comment: null }).isTrustworthy()).toBe(true);
      });

      it("スコア 0.59 のレビューは信頼できない", () => {
        // 評価4: 0.75×0.7=0.525, 9文字: 0.2×0.3=0.06 → 0.585 → 0.59
        expect(createReview({ rating: 4, comment: "a".repeat(9) }).isTrustworthy()).toBe(false);
      });
    });

    describe("閾値の境界", () => {
      it("閾値 0 では最低スコアのレビューも信頼できる（下限）", () => {
        // 評価1・コメントなし: スコア 0
        expect(createReview({ rating: 1, comment: null }).isTrustworthy(new Threshold(0))).toBe(true);
      });

      it("閾値 1.0 では最高スコアのレビューだけが信頼できる（上限）", () => {
        expect(createReview({ rating: 5, comment: "a".repeat(100) }).isTrustworthy(new Threshold(1.0))).toBe(true);
        expect(createReview({ rating: 5, comment: null }).isTrustworthy(new Threshold(1.0))).toBe(false);
      });

      it("浮動小数点の誤差があっても、スコアと等しい閾値なら信頼できる", () => {
        // 評価3・100文字: 丸め前は 0.6499999999999999 → 0.65
        expect(createReview({ rating: 3, comment: "a".repeat(100) }).isTrustworthy(new Threshold(0.65))).toBe(true);
        // 評価4・コメントなし: 丸め前は 0.5249999999999999 → 0.53
        expect(createReview({ rating: 4, comment: null }).isTrustworthy(new Threshold(0.53))).toBe(true);
      });
    });
  });
});

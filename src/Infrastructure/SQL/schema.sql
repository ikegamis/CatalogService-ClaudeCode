-- =============================================================================
-- Catalog スキーマ定義（PostgreSQL 17。PostgreSQL 15 以降で動作する構文のみを用いる）
--
-- 根拠: doc/domain/models/Book/Book.md, doc/domain/models/Review/Review.md,
--       doc/infrastructure/infrastructure.md（「ドメイン定義を読んで全てのテーブルを作成する」）
--
-- 方針:
--   - 1 集約 = 1 テーブル。値オブジェクトは集約ルートのカラムに展開する。
--   - CHECK 制約はドメインの検証の代替ではなく最後の防衛線（CLAUDE.md §9）。
--     ドメインは string.length（UTF-16 コード単位）で文字数を数えるが、PostgreSQL の char_length は
--     コードポイント数を数える。サロゲートペアを含む文字列ではコードポイント数の方が少なくなるため、
--     上限側の CHECK はドメインより緩くなり、ドメインで有効な値を DB が拒否することはない。
--     同じ理由で book_id の「13文字固定」は DB では上限 13 のみを課す。
--   - 何度実行しても同じ結果になるよう IF NOT EXISTS を用いる（migrations.ts から適用する）。
--
-- ロールバック方針（手動。既存データを破壊するため、実行には明示的な承認が必要）:
--   DROP TABLE IF EXISTS review; DROP TABLE IF EXISTS book;
-- =============================================================================

-- 書籍集約（Book）。書籍集約は削除できない（Book.md「制約」）。
-- 楽観的排他制御用の version カラムは、書籍を更新するユースケースがないため導入しない（決定事項）。
CREATE TABLE IF NOT EXISTS book (
    book_id  varchar(13)   NOT NULL,
    title    varchar(1000) NOT NULL,
    author   varchar(100)  NOT NULL,
    -- 日本円・整数円（Price は 1〜1,000,000 円）。浮動小数点型は使わない。
    price    integer       NOT NULL,
    CONSTRAINT book_pkey         PRIMARY KEY (book_id),
    CONSTRAINT book_book_id_len  CHECK (char_length(book_id) >= 1),
    CONSTRAINT book_title_len    CHECK (char_length(title) >= 1),
    CONSTRAINT book_author_len   CHECK (char_length(author) >= 1),
    CONSTRAINT book_price_range  CHECK (price BETWEEN 1 AND 1000000)
);

-- レビュー集約（Review）。
-- book_id には book への外部キーを張らない。
--   - UC-REVIEW-002 は「書籍の存在を確認しない」と定めており、外部キーがあると未登録の書籍IDへの更新が
--     技術エラーになる。
--   - Review は Book を ID で参照する別集約であり、同一 Bounded Context かも未確定（context-map.md）。
--   - InMemory 実装と同じポート契約を保つため。
CREATE TABLE IF NOT EXISTS review (
    -- ULID（Crockford Base32、26文字）。ASCII のみなので形式を CHECK で厳密に検証できる。
    review_id  char(26)      NOT NULL,
    book_id    varchar(13)   NOT NULL,
    -- 投稿者名は trim 済み・常に存在する（匿名投稿は「名無し」）。
    name       varchar(50)   NOT NULL,
    rating     smallint      NOT NULL,
    -- コメントなしは NULL で表す。
    comment    varchar(1000) NULL,
    CONSTRAINT review_pkey           PRIMARY KEY (review_id),
    CONSTRAINT review_review_id_fmt  CHECK (review_id ~ '^[0-7][0-9A-HJKMNP-TV-Z]{25}$'),
    CONSTRAINT review_book_id_len    CHECK (char_length(book_id) >= 1),
    CONSTRAINT review_name_len       CHECK (char_length(name) >= 1),
    CONSTRAINT review_rating_range   CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT review_comment_len    CHECK (comment IS NULL OR char_length(comment) >= 1)
);

-- IReviewRepository.findAllByBookId（書籍推薦）用。review_id を含めて取得順（review_id 順）のソートも賄う。
CREATE INDEX IF NOT EXISTS review_book_id_review_id_idx ON review (book_id, review_id);

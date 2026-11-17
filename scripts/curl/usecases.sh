#!/bin/sh
# =============================================================================
# ユースケースごとに 3 件ほど API を呼んで確認するスクリプト。
#
# 前提: API サーバーが起動していて、DB が空であること（書籍もレビューもない状態）。
#       ユースケースの順に実行し、前のユースケースで登録したデータを後のユースケースで使う。
#
# 実行: sh scripts/curl/usecases.sh
#       BASE_URL=http://localhost:3000 VERBOSE=1 sh scripts/curl/usecases.sh
#
# 終了コード: 0 = すべて期待どおり / 1 = 期待と異なる応答あり / 2 = 実行の前提を満たさない
#
# 失敗時のステータスは API 仕様（doc/presentation/openapi.yml）どおり、理由によらず 500。
# =============================================================================
set -eu

. "$(dirname "$0")/lib.sh"

require_server

BOOK="9784000000001"
UNKNOWN_BOOK="9784999999999"
UNKNOWN_REVIEW="01JD00000000000000000000ZZ"

# -----------------------------------------------------------------------------
section "UC-BOOK-001 書籍登録（POST /book）"

step "1. 未登録の書籍を登録できる → 201 と登録した書籍"
call POST /book '{"isbn":"'"$BOOK"'","title":"ドメイン駆動設計入門","author":"著者A","price":3200}'
require_fresh_database
expect_status 201
expect_body '{"ok":true,"book":{"isbn":"'"$BOOK"'","title":"ドメイン駆動設計入門","author":"著者A","price":3200}}'

step "2. 同じ書籍IDは登録できない → 500"
call POST /book '{"isbn":"'"$BOOK"'","title":"別のタイトル","author":"著者B","price":1000}'
expect_failure "書籍ID '$BOOK' は既に登録されています。"

step "3. 価格が整数円でない → 500"
call POST /book '{"isbn":"9784000000002","title":"小数の価格","author":"著者C","price":1500.5}'
expect_failure "Priceは整数円である必要があります。"

# -----------------------------------------------------------------------------
section "UC-REVIEW-001 レビューの登録（POST /review）"

step "1. 投稿者名・コメント付きで登録できる → 201 と登録したレビュー"
call POST /review '{"bookId":"'"$BOOK"'","name":"山田","rating":5,"comment":"『オブジェクト指向入門』を先に読むと理解が深まります。"}'
expect_status 201
expect_contains '"bookId":"'"$BOOK"'","name":"山田","rating":5,"comment":"『オブジェクト指向入門』を先に読むと理解が深まります。"}}'
REVIEW_1=$(review_id)

step "2. 投稿者名・コメントを省略すると「名無し」・コメントなし（null）で登録される → 201"
call POST /review '{"bookId":"'"$BOOK"'","rating":3}'
expect_status 201
expect_contains '"name":"名無し","rating":3,"comment":null}}'
REVIEW_2=$(review_id)

step "3. 未登録の書籍にはレビューできない → 500"
call POST /review '{"bookId":"'"$UNKNOWN_BOOK"'","name":"山田","rating":4}'
expect_failure "書籍ID '$UNKNOWN_BOOK' の書籍は登録されていません。"

# -----------------------------------------------------------------------------
section "UC-REVIEW-002 レビューの更新（PUT /review/{id}）"

step "1. レビューID以外を更新できる → 200 と更新後のレビュー（IDは変わらない）"
call PUT "/review/$REVIEW_1" '{"bookId":"'"$BOOK"'","name":"山田太郎","rating":4,"comment":"『オブジェクト指向入門』と『リファクタリング』を読んでおくと良いです。どちらも基礎から丁寧に説明されています。"}'
expect_status 200
expect_body '{"ok":true,"review":{"id":"'"$REVIEW_1"'","bookId":"'"$BOOK"'","name":"山田太郎","rating":4,"comment":"『オブジェクト指向入門』と『リファクタリング』を読んでおくと良いです。どちらも基礎から丁寧に説明されています。"}}'

step "2. 登録されていないレビューIDは更新できない → 500"
call PUT "/review/$UNKNOWN_REVIEW" '{"bookId":"'"$BOOK"'","rating":4}'
expect_failure "レビューID '$UNKNOWN_REVIEW' のレビューは登録されていません。"

step "3. 評価が 1〜5 の範囲外 → 500"
call PUT "/review/$REVIEW_1" '{"bookId":"'"$BOOK"'","rating":6}'
expect_failure "Ratingは1以上5以下の整数である必要があります。"

# -----------------------------------------------------------------------------
section "UC-CATALOG-003 レビューの削除（DELETE /review/{id}）"

step "1. 登録済みのレビューを削除できる → 200 と削除メッセージ"
call DELETE "/review/$REVIEW_2"
expect_status 200
expect_body "{\"ok\":true,\"message\":\"'$REVIEW_2' は削除されました\"}"

step "2. 削除済みのレビューはもう一度削除できない → 500"
call DELETE "/review/$REVIEW_2"
expect_failure "レビューID '$REVIEW_2' のレビューは登録されていません。"

step "3. レビューIDが ULID の形式でない → 500"
call DELETE "/review/abc"
expect_failure "ReviewIdは26文字のULIDである必要があります。"

# -----------------------------------------------------------------------------
section "UC-CATALOG-001 書籍推薦（GET /book/{isbn}/recommendations）"
# この時点のレビューは更新後の REVIEW_1 だけ（評価 4、55文字のコメント → 信頼性スコア 0.71）。

step "1. threshold 省略（既定値 0.6）→ 200 と言及された書籍（同数なのでコメント内で先に現れた順）"
call GET "/book/$BOOK/recommendations"
expect_recommendations '"オブジェクト指向入門","リファクタリング"'

step "2. threshold=1（信頼性スコア 1.0 のレビューだけ）→ 200 と空の配列"
call GET "/book/$BOOK/recommendations?threshold=1"
expect_recommendations ''

step "3. threshold が 0〜1 の範囲外 → 500"
call GET "/book/$BOOK/recommendations?threshold=1.5"
expect_failure "Thresholdは0以上1以下である必要があります。"

step "4. 登録されていない書籍 → 200 と空の配列（エラーにしない）"
call GET "/book/$UNKNOWN_BOOK/recommendations"
expect_recommendations ''

summary

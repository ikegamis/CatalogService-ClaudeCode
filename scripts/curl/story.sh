#!/bin/sh
# =============================================================================
# ストーリーテスト（正常系・異常系）。複数のユースケースを利用者の操作の流れに沿って続けて呼び、
# 各操作の応答と、操作の結果が後の操作（主に書籍推薦）にどう反映されるかを検証する。
#
# 前提: API サーバーが起動していて、DB が空であること（書籍もレビューもない状態）。
#       書籍ID は usecases.sh と重ならないので、usecases.sh の後に続けて実行してもよい。
#
# 実行: sh scripts/curl/story.sh            正常系と異常系
#       sh scripts/curl/story.sh normal     正常系だけ
#       sh scripts/curl/story.sh error      異常系だけ
#       BASE_URL=http://localhost:3000 VERBOSE=1 sh scripts/curl/story.sh
#
# 終了コード: 0 = すべて期待どおり / 1 = 期待と異なる応答あり / 2 = 実行の前提を満たさない
#
# 失敗時のステータスは API 仕様（doc/presentation/openapi.yml）どおり、理由によらず 500。
# =============================================================================
set -eu

. "$(dirname "$0")/lib.sh"

# -----------------------------------------------------------------------------
# 正常系：書籍を登録し、読者のレビューの登録・更新・削除に応じて推薦結果が変わる
#
# 信頼性スコア = 評価の品質係数 × 0.7 + コメントの品質係数 × 0.3（小数点以下2桁に四捨五入）
#   佐藤（評価 5、133文字）→ 1.00 / 鈴木（評価 4、31文字）→ 0.64 / 名無し（評価 1、10文字）→ 0.06
#   鈴木の更新後（評価 4、28文字）→ 0.63
# -----------------------------------------------------------------------------
normal_story() {
  BOOK="9784100000001"

  section "正常系：レビューに応じて推薦書籍が変わる"

  step "1. 書店員が書籍「実践ドメイン駆動設計」を登録する → 201"
  call POST /book '{"isbn":"'"$BOOK"'","title":"実践ドメイン駆動設計","author":"著者D","price":5000}'
  require_fresh_database
  expect_status 201
  expect_body '{"ok":true,"book":{"isbn":"'"$BOOK"'","title":"実践ドメイン駆動設計","author":"著者D","price":5000}}'

  step "2. まだレビューがないので、推薦書籍はない → 200 と空の配列"
  call GET "/book/$BOOK/recommendations"
  expect_recommendations ''

  step "3. 佐藤さんが長文のレビューを書く（前提書籍2冊と、この本自身に言及）→ 201"
  call POST /review '{"bookId":"'"$BOOK"'","name":"佐藤","rating":5,"comment":"『ドメイン駆動設計入門』を先に読むと、この本の内容がすっと理解できます。『オブジェクト指向入門』も合わせて読むと良いでしょう。『実践ドメイン駆動設計』は二回目に読むとさらに理解が深まりました。全体として実例が豊富で、設計の考え方を順を追って学べる構成になっています。"}'
  expect_status 201
  expect_contains '"bookId":"'"$BOOK"'","name":"佐藤","rating":5,'
  SATO=$(review_id)

  step "4. 鈴木さんが『ドメイン駆動設計入門』を勧めるレビューを書く → 201"
  call POST /review '{"bookId":"'"$BOOK"'","name":"鈴木","rating":4,"comment":"『ドメイン駆動設計入門』を読んだ後だと理解しやすい一冊でした。"}'
  expect_status 201
  expect_contains '"name":"鈴木","rating":4,"comment":"『ドメイン駆動設計入門』を読んだ後だと理解しやすい一冊でした。"}}'
  SUZUKI=$(review_id)

  step "5. 匿名の読者が短く低評価のレビューを書く（投稿者名は「名無し」になる）→ 201"
  call POST /review '{"bookId":"'"$BOOK"'","name":null,"rating":1,"comment":"『UML入門』がいい"}'
  expect_status 201
  expect_contains '"name":"名無し","rating":1,"comment":"『UML入門』がいい"}}'

  step "6. 推薦（既定の閾値 0.6）→ 言及の多い順。この本自身と、信頼できない匿名レビューの書籍は含まない"
  call GET "/book/$BOOK/recommendations"
  expect_recommendations '"ドメイン駆動設計入門","オブジェクト指向入門"'

  step "7. 推薦（閾値 0）→ 匿名レビューの書籍も、品質の低いレビューの言及として最後に含まれる"
  call GET "/book/$BOOK/recommendations?threshold=0"
  expect_recommendations '"ドメイン駆動設計入門","オブジェクト指向入門","UML入門"'

  step "8. 鈴木さんがレビューを書き直す（投稿者名・コメントを変更）→ 200 と更新後のレビュー"
  call PUT "/review/$SUZUKI" '{"bookId":"'"$BOOK"'","name":"鈴木一郎","rating":4,"comment":"『テスト駆動開発』を読んでから読むと理解が深まりました。"}'
  expect_status 200
  expect_body '{"ok":true,"review":{"id":"'"$SUZUKI"'","bookId":"'"$BOOK"'","name":"鈴木一郎","rating":4,"comment":"『テスト駆動開発』を読んでから読むと理解が深まりました。"}}'

  step "9. 推薦 → 鈴木さんの言及が入れ替わり、すべて1回ずつ（品質の高い佐藤さんのレビューの書籍が先）"
  call GET "/book/$BOOK/recommendations"
  expect_recommendations '"ドメイン駆動設計入門","オブジェクト指向入門","テスト駆動開発"'

  step "10. 佐藤さんがレビューを削除する → 200 と削除メッセージ"
  call DELETE "/review/$SATO"
  expect_status 200
  expect_body "{\"ok\":true,\"message\":\"'$SATO' は削除されました\"}"

  step "11. 推薦 → 佐藤さんの言及がなくなる"
  call GET "/book/$BOOK/recommendations"
  expect_recommendations '"テスト駆動開発"'
}

# -----------------------------------------------------------------------------
# 異常系：誤った操作はすべて 500 と理由を返し、それまでに登録したデータを変えない
# -----------------------------------------------------------------------------
error_story() {
  BOOK="9784200000001"
  UNKNOWN_REVIEW="01JD00000000000000000000ZZ"
  # 51文字の投稿者名（上限は 50 文字）
  LONG_NAME=$(i=0; while [ "$i" -lt 51 ]; do printf 'a'; i=$((i + 1)); done)

  section "異常系：誤った操作をしてもデータは変わらない"

  step "1. 書籍を登録する前にレビューを書こうとする → 500"
  call POST /review '{"bookId":"'"$BOOK"'","name":"高橋","rating":5}'
  expect_failure "書籍ID '$BOOK' の書籍は登録されていません。"

  step "2. 書籍IDが13文字でない → 500"
  call POST /book '{"isbn":"978420000000","title":"異常系の対象書籍","author":"著者E","price":2000}'
  expect_failure "BookIdは13文字である必要があります。"

  step "3. 価格を文字列で送る → 500"
  call POST /book '{"isbn":"'"$BOOK"'","title":"異常系の対象書籍","author":"著者E","price":"2000"}'
  expect_failure "price は必須の数値です。"

  step "4. タイトルがない → 500"
  call POST /book '{"isbn":"'"$BOOK"'","author":"著者E","price":2000}'
  expect_failure "title は必須の文字列です。"

  step "5. JSON が壊れている → 500"
  call POST /book '{"isbn":"'"$BOOK"'",'
  expect_failure "リクエストボディが不正な JSON です。"

  step "6. Content-Type が JSON でない → 500"
  call POST /book '{"isbn":"'"$BOOK"'","title":"異常系の対象書籍","author":"著者E","price":2000}' text/plain
  expect_failure "リクエストボディは JSON オブジェクトである必要があります。"

  step "7. 正しい内容で書籍を登録する → 201（ここまでの失敗では何も登録されていない）"
  call POST /book '{"isbn":"'"$BOOK"'","title":"異常系の対象書籍","author":"著者E","price":2000}'
  require_fresh_database
  expect_status 201

  step "8. 同じ書籍IDでもう一度登録する → 500"
  call POST /book '{"isbn":"'"$BOOK"'","title":"上書きしようとしたタイトル","author":"著者F","price":1}'
  expect_failure "書籍ID '$BOOK' は既に登録されています。"

  step "9. 評価が 0 → 500"
  call POST /review '{"bookId":"'"$BOOK"'","name":"高橋","rating":0}'
  expect_failure "Ratingは1以上5以下の整数である必要があります。"

  step "10. 評価が小数 → 500"
  call POST /review '{"bookId":"'"$BOOK"'","name":"高橋","rating":3.5}'
  expect_failure "Ratingは1以上5以下の整数である必要があります。"

  step "11. 投稿者名が 51 文字 → 500"
  call POST /review '{"bookId":"'"$BOOK"'","name":"'"$LONG_NAME"'","rating":5}'
  expect_failure "Nameは1文字以上50文字以下である必要があります。"

  step "12. コメントを数値で送る → 500"
  call POST /review '{"bookId":"'"$BOOK"'","name":"高橋","rating":5,"comment":123}'
  expect_failure "comment は文字列または null である必要があります。"

  step "13. 推薦 → 失敗したレビューは1件も登録されていない"
  call GET "/book/$BOOK/recommendations?threshold=0"
  expect_recommendations ''

  step "14. 正しい内容でレビューを登録する → 201"
  call POST /review '{"bookId":"'"$BOOK"'","name":"高橋","rating":5,"comment":"『エリック・エヴァンスのドメイン駆動設計』を読んでおくと理解しやすいです。"}'
  expect_status 201
  TAKAHASHI=$(review_id)

  step "15. 推薦 → 登録したレビューの書籍が推薦される"
  call GET "/book/$BOOK/recommendations"
  expect_recommendations '"エリック・エヴァンスのドメイン駆動設計"'

  step "16. 登録されていないレビューIDを更新する → 500"
  call PUT "/review/$UNKNOWN_REVIEW" '{"bookId":"'"$BOOK"'","name":"高橋","rating":5,"comment":"『別の本』を読むと良い"}'
  expect_failure "レビューID '$UNKNOWN_REVIEW' のレビューは登録されていません。"

  step "17. ULID の形式でないレビューIDを更新する → 500"
  call PUT "/review/not-a-ulid" '{"bookId":"'"$BOOK"'","rating":5}'
  expect_failure "ReviewIdは26文字のULIDである必要があります。"

  step "18. 書籍IDを付けずに更新する → 500"
  call PUT "/review/$TAKAHASHI" '{"name":"高橋","rating":5,"comment":"『別の本』を読むと良い"}'
  expect_failure "bookId は必須の文字列です。"

  step "19. 評価を小数にして更新する → 500"
  call PUT "/review/$TAKAHASHI" '{"bookId":"'"$BOOK"'","name":"高橋","rating":4.5,"comment":"『別の本』を読むと良い"}'
  expect_failure "Ratingは1以上5以下の整数である必要があります。"

  step "20. 推薦 → 失敗した更新ではレビューが変わっていない"
  call GET "/book/$BOOK/recommendations"
  expect_recommendations '"エリック・エヴァンスのドメイン駆動設計"'

  step "21. threshold が数値でない → 500"
  call GET "/book/$BOOK/recommendations?threshold=abc"
  expect_failure "threshold は数値である必要があります。"

  step "22. threshold が負の数 → 500"
  call GET "/book/$BOOK/recommendations?threshold=-0.1"
  expect_failure "Thresholdは0以上1以下である必要があります。"

  step "23. パスのレビューIDのエンコードが不正 → 500"
  call DELETE "/review/%E0%A4%A"
  expect_failure "URL のパスに不正なエンコードが含まれています。"

  step "24. レビューを削除する → 200"
  call DELETE "/review/$TAKAHASHI"
  expect_status 200

  step "25. 同じレビューをもう一度削除する → 500"
  call DELETE "/review/$TAKAHASHI"
  expect_failure "レビューID '$TAKAHASHI' のレビューは登録されていません。"

  step "26. 推薦 → 削除したレビューの書籍は推薦されない"
  call GET "/book/$BOOK/recommendations"
  expect_recommendations ''
}

require_server

case "${1:-all}" in
  normal) normal_story ;;
  error) error_story ;;
  all) normal_story; error_story ;;
  *)
    echo "使い方: sh $0 [normal|error|all]" >&2
    exit 2
    ;;
esac

summary

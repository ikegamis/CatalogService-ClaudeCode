# shellcheck shell=sh
# =============================================================================
# curl で API を呼び、応答を検証するための共通関数（usecases.sh / story.sh から読み込む）。
#
# 環境変数
#   BASE_URL  API の URL（既定: http://localhost:3000）
#   VERBOSE   1 にすると成功した検証も1件ずつ表示する（既定: 0）
#
# 応答の JSON は Express の res.json の出力（空白なし・キーの順序は実装どおり）を文字列として比較する。
# =============================================================================

BASE_URL="${BASE_URL:-http://localhost:3000}"
VERBOSE="${VERBOSE:-0}"

PASSED=0
FAILED=0
STATUS=""
RESPONSE=""

if [ -t 1 ]; then
  C_GREEN=$(printf '\033[32m'); C_RED=$(printf '\033[31m'); C_BOLD=$(printf '\033[1m'); C_DIM=$(printf '\033[2m'); C_RESET=$(printf '\033[0m')
else
  C_GREEN=""; C_RED=""; C_BOLD=""; C_DIM=""; C_RESET=""
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl が見つかりません。curl をインストールしてから実行してください。" >&2
  exit 2
fi

# 見出しを表示する。
section() {
  printf '\n%s== %s ==%s\n' "$C_BOLD" "$1" "$C_RESET"
}

# 1件の確認内容を表示する。
step() {
  printf '\n%s-- %s%s\n' "$C_BOLD" "$1" "$C_RESET"
}

# API を呼ぶ。結果は STATUS（HTTP ステータス）と RESPONSE（ボディ）に入る。
#   call METHOD PATH                 ボディなし
#   call METHOD PATH JSON            Content-Type: application/json でボディを送る
#   call METHOD PATH BODY CONTENT_TYPE  Content-Type を指定してボディを送る
call() {
  _method=$1
  _path=$2
  _out=$(mktemp)
  if [ "$#" -ge 3 ]; then
    _type=${4:-application/json}
    printf '%s$ curl -X %s %s%s -H "Content-Type: %s" -d %s%s\n' "$C_DIM" "$_method" "$BASE_URL" "$_path" "$_type" "'$3'" "$C_RESET"
    STATUS=$(curl -sS -o "$_out" -w '%{http_code}' -X "$_method" -H "Content-Type: $_type" --data-binary "$3" "$BASE_URL$_path") || STATUS="000"
  else
    printf '%s$ curl -X %s %s%s%s\n' "$C_DIM" "$_method" "$BASE_URL" "$_path" "$C_RESET"
    STATUS=$(curl -sS -o "$_out" -w '%{http_code}' -X "$_method" "$BASE_URL$_path") || STATUS="000"
  fi
  RESPONSE=$(cat "$_out")
  rm -f "$_out"
  printf '   -> %s %s\n' "$STATUS" "$RESPONSE"
}

pass() {
  PASSED=$((PASSED + 1))
  if [ "$VERBOSE" = "1" ]; then
    printf '   %sOK%s %s\n' "$C_GREEN" "$C_RESET" "$1"
  fi
}

fail() {
  FAILED=$((FAILED + 1))
  printf '   %sNG%s %s\n' "$C_RED" "$C_RESET" "$1"
}

# HTTP ステータスを検証する。
expect_status() {
  if [ "$STATUS" = "$1" ]; then
    pass "ステータス $1"
  else
    fail "ステータス: 期待 $1 / 実際 $STATUS"
  fi
}

# ボディ全体が一致することを検証する。
expect_body() {
  if [ "$RESPONSE" = "$1" ]; then
    pass "ボディ $1"
  else
    fail "ボディ: 期待 $1 / 実際 $RESPONSE"
  fi
}

# ボディに文字列が含まれることを検証する。
expect_contains() {
  case "$RESPONSE" in
    *"$1"*) pass "ボディに $1 を含む" ;;
    *) fail "ボディに $1 を含まない（実際 $RESPONSE）" ;;
  esac
}

# 失敗応答（500 + FalseMessage）で、message が一致することを検証する。
expect_failure() {
  expect_status 500
  expect_body "{\"ok\":false,\"message\":\"$1\"}"
}

# 推薦結果を検証する。引数は JSON 配列の中身（例: '"A","B"'。空なら ''）。
expect_recommendations() {
  expect_status 200
  expect_body "{\"ok\":true,\"recommendedBooks\":[$1]}"
}

# 直前の応答（レビューの登録・更新）からレビューIDを取り出す。
review_id() {
  printf '%s' "$RESPONSE" | sed -n 's/.*"id":"\([0-9A-Z]\{26\}\)".*/\1/p'
}

# API に接続できることを確認する（未登録の書籍の推薦は、DB が空でも 200 を返す）。
require_server() {
  if ! curl -sS -o /dev/null "$BASE_URL/book/9784999999999/recommendations"; then
    echo "API（$BASE_URL）に接続できません。サーバーを起動してから実行してください。" >&2
    exit 2
  fi
}

# DB が空の状態から実行したことを確認する。最初の書籍登録の直後に呼ぶ。
# API には削除や一覧がなく、2回目以降は登録済みのデータで結果が変わるため、既に登録されていれば中断する。
require_fresh_database() {
  case "$RESPONSE" in
    *"は既に登録されています。"*)
      echo "" >&2
      echo "書籍が既に登録されています。このスクリプトは DB が空の状態から実行してください。" >&2
      echo "（例: psql で TRUNCATE review, book; を実行してから再実行する）" >&2
      exit 2
      ;;
  esac
}

# 結果を表示し、失敗があれば終了コード 1 で終える。
summary() {
  printf '\n%s== 結果 ==%s 成功 %d 件 / 失敗 %d 件\n' "$C_BOLD" "$C_RESET" "$PASSED" "$FAILED"
  if [ "$FAILED" -gt 0 ]; then
    printf '%s失敗した検証があります。%s\n' "$C_RED" "$C_RESET"
    exit 1
  fi
  printf '%sすべての検証に成功しました。%s\n' "$C_GREEN" "$C_RESET"
}

---
name: review-presentation
description: API仕様と各層のコード・HTTPテストを照合し Presentation 層をレビューする
---

# review-presentation

## 目的

HTTP API の契約、入力検証、エラー変換、依存方向、テスト品質をレビューする。原則としてコードは変更しない。

## 対象資料

- `CLAUDE.md` と対象 `doc/models/` / API仕様
- `src/Domain`、`src/Application`、`test/Application`
- `src/Presentation`、`test/Presentation`

## レビュー観点

### API契約
- HTTPメソッド、パス、パラメーター、JSONスキーマ、ステータスコードが仕様と一致するか
- 成功・エラー応答の形式が一貫しているか
- Domain モデルや内部情報を漏らしていないか
- ページング、ソート、冪等性、キャッシュ等が必要な場合に仕様化されているか

### 入力・セキュリティ
- すべての外部入力を実行時検証しているか
- 認証・認可の境界が正しいか
- マスアサインメント、過剰な情報公開、内部例外の漏えいがないか
- CORS等の設定が要件に合っているか

### 責務・依存
- Controller がユースケースの調整以上の業務ロジックを持っていないか
- Infrastructure の具象クラスに直接依存していないか
- DI登録が composition root に集約されているか
- Express app と listen 起動が分離されているか

### エラー処理・テスト
- Express 5 の非同期エラーが適切に伝播するか
- エラー処理ミドルウェアが一元化されているか
- HTTP成功・入力エラー・業務エラー・予期しない例外のテストがあるか
- テストが実際のHTTP境界を検証しているか

## 指摘形式

ID（PRE-001）、重大度（Critical / High / Medium / Low）、対象ファイル・行番号、仕様根拠、問題・影響、修正案、必要なテストを記載する。

仕様未定義は「仕様確認事項」に分離し、勝手に期待値を作らない。

## 禁止事項

レビュー中に黙って修正しない。根拠のないスタイル上の好みを欠陥として報告しない。

## 報告

Pass / Pass with concerns / Needs changes、指摘一覧、仕様確認事項、テスト結果、次工程へのブロッカーを報告する。重大なAPI契約・セキュリティ問題が残る場合は Infrastructure 工程に進まないよう明記する。

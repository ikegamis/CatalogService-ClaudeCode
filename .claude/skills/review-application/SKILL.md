---
name: review-application
description: ユースケース仕様と Domain / Application 実装・テストを照合して Application 層をレビューする
---

# review-application

## 目的

Application 層がユースケースを正しくオーケストレーションし、Domain とオニオンアーキテクチャの境界を守っているかレビューする。原則としてコードは変更しない。

## 対象資料

- `CLAUDE.md`
- 対象 `doc/models/` の Markdown / PlantUML / mermaid / ユースケース定義
- `src/Domain`、`test/Domain`
- `src/Application`、`test/Application`

## レビュー観点

1. **ユースケース適合性**：入力、事前条件、処理順序、出力、業務エラーが仕様と一致しているか。
2. **責務分担**：Application が調整役に徹し、業務ルールを Domain に委譲しているか。
3. **ポート設計**：必要な Repository / 外部連携ポートが適切に抽象化され、具象技術に依存していないか。
4. **トランザクション**：整合性要件に沿った境界か。途中失敗時の状態が安全か。
5. **イベント**：イベント発行のタイミング、重複、順序、失敗時の扱いが明確か。必要性のないパターンを導入していないか。
6. **エラー処理**：業務エラーと技術エラーを区別し、例外を握りつぶしていないか。
7. **DTO**：Domain モデルを不用意に漏らさず、入力・出力の契約が明確か。
8. **テスト**：主要分岐、業務エラー、ポート障害、トランザクション要件が検証されているか。
9. **依存方向**：Application が Infrastructure / Presentation / Express / PostgreSQL / tsyringe に依存していないか。

## 指摘形式

各指摘に ID（APP-001）、重大度（Critical / High / Medium / Low）、ファイル・行番号、仕様根拠、問題・影響、修正方針、必要なテストを含める。

仕様に記載がなく判断できない事項は「仕様確認事項」として分け、欠陥と断定しない。好みだけの指摘はしない。

## 禁止事項

レビュー中に黙ってコードを変更しない。修正が必要な場合は、対象箇所と変更案を提示する。

## 報告

Pass / Pass with concerns / Needs changes の判定、指摘一覧、仕様確認事項、テスト・Lint・型チェック結果、次工程へのブロッカーを報告する。Critical / High が残る場合は Presentation 工程に進まないよう明記する。

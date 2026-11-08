# 書籍レビュー管理システム ドメインモデル定義

このディレクトリは、Claude Code DDD WebAPI Kit の `doc/models/` に配置する人間作成の入力資料サンプルです。

## ファイル構成

```text
doc/models/
├─ README.md
├─ glossary.md
├─ context-map.md
└─ catalog/
   ├─ catalog-domain.md
   ├─ catalog-aggregate.puml
   └─ catalog-use-cases.md
```

## モデルの概要

- 書籍集約（Book）とレビュー集約（Review）を定義する。
- Review は BookId によって対象書籍を参照する。
- 書籍推薦は、対象書籍に関するレビューを複数取得し、信頼性判定・前提書籍抽出・言及頻度集計を行うユースケースとして整理する。

元のPlantUMLは「カタログドメインモデル」として2つの集約を同じ図に記載しているため、このサンプルでは `catalog/` を1つのモデル領域として整理している。ただし、これが正式な Bounded Context 境界であるかは元資料だけでは確定できない。詳細は `context-map.md` を参照する。

## Claude Code での実行例

```text
/make-domain catalog の Book 集約と Review 集約を対象にしてください。
まず doc/models/README.md、glossary.md、context-map.md、catalog/catalog-domain.md、catalog/catalog-aggregate.puml を読み、仕様の不足・矛盾を列挙してください。
未確定事項を推測で補わず、確認が必要な点を報告してください。
```

```text
/make-application 書籍推薦ユースケースを対象にしてください。
doc/models/catalog/catalog-use-cases.md と関連するドメイン定義を読み、Application 層の責務と必要なポートを整理してください。
未確定事項が実装に影響する場合は、実装前に質問してください。
```

## 注意

この資料は元のPlantUMLを構造化したものであり、未確定の業務ルールを確定するものではない。特にレビュー信頼性スコアの合成式、前提書籍名と Book の対応付け、推薦件数などは別途決定が必要。

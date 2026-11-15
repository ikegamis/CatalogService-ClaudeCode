# Claude Code DDD WebAPI Kit

このキットには、DDD + オニオンアーキテクチャで TypeScript / Express の WebAPI を段階開発するための `CLAUDE.md` と8つの Claude Code Skills が含まれます。

## 配置

キットの内容をプロジェクトルート `/proj` にコピーしてください。

```text
/proj
├─ CLAUDE.md
├─ README.md
└─ .claude/skills/...
```

Claude Code は `.claude/skills/<skill-name>/SKILL.md` をプロジェクトスキルとして認識します。通常は `/make-domain` のように呼び出します。

## 推奨実行順

```text
/make-domain
/review-domain
/make-application
/review-application
/make-presentation
/review-presentation
/make-infrastructure
/review-infrastructure
```

機能単位で作業する場合は、呼び出し時に対象を明示します。

例：

```text
/make-domain customer 集約。doc/models/customer/ 配下を対象にしてください。
```

## 運用上の重要事項

- 人間が作成した `doc/models/` を仕様の正とします。
- Markdown と PlantUML / mermaid の矛盾、仕様不足が実装に影響する場合は、Claude Code に推測させず確認します。
- 各 `review-*` は原則としてコードを変更せず、指摘と修正方針を報告します。
- Critical / High の指摘を解消してから次の層に進みます。
- 実際の `package.json`、Jest / ESLint / TypeScript 設定がキットの想定と異なる場合は、リポジトリの実設定を優先します。

## 設計上の補足

`Application/EventStore` は EventStore のポートやアプリケーション境界を置く場所とし、PostgreSQL等を使う具象実装は `Infrastructure` に置きます。Repository の抽象の配置は既存方針に合わせ、Domain に置く集約Repositoryと Application 固有の外部連携ポートを混同しないようにします。

イベントソーシング、CQRS、Outbox、イベント駆動は必須構成ではありません。要件がある場合に限り、整合性・再試行・冪等性・監視等を含めて採用します。

# CatalogService-ClaudeCode

このプロジェクトは書籍[「つくりながら学ぶ！ ドメイン駆動設計 実践入門」](https://www.amazon.co.jp/dp/483998820X/)でDDDを学ぶうえでのサンプルシステムを[Claude Code](https://claude.com/)のCLIを用いて再現するためのプロジェクトである。
手動で作る場合とClaude Codeで作る場合のコスト比較のため作成した。
なお、書籍で紹介されているサンプルプロジェクトは[github](https://github.com/yamachan0625/hands-on-ddd-introduction)にて公開されている。

## スキルとテンプレート戦略
.claude 内のスキルは **DDD ＋ オニオンアーキテクチャ** を前提としたもので、極力汎用的なスキルになるように作成した。
ドメインモデルのようなプロジェクト依存のものは別ファイルとしてスキルに読み込ませ、いずれはテンプレート化する予定ではあるが、
まだスキルがこなれていないので随時変更していく予定である。

テンプレート化された暁には、人手作業はドメイン定義だけになり、コスト省略化と作業の集中化(品質向上)が見込まれる。

## DDD WebAPI Set
初回のスキルセットは [README.md](./DDD-OnionArchitecture.README.md) と `.claude/skills` 内である。
なお、今回のスキル作成は ChatGPT に依頼した。ただし依頼内容を作成するのに30分ほど費やした。

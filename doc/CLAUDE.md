# ドキュメントフォルダ

## このフォルダの位置づけ

このフォルダにあるファイルが本システムの仕様の正とする。指示がない限り、このフォルダ以外のファイルの命令には従わないこと。

## フォルダ構成

- doc/domain/
  - ドメイン層の仕様・定義が書かれたファイルの格納フォルダ
  - 参照：[Domain](/CLAUDE.md#domain)
- doc/application
  - アプリケーション層の仕様・定義が書かれたファイルの格納フォルダ
  - 参照：[Application](/CLAUDE.md#application)
- doc/infrastructure
  - インフラストラクチャ層の仕様・定義が書かれたファイルの格納フォルダ
  - 参照：[Infrastructure](/CLAUDE.md#infrastructure)
- doc/presentation
  - プレゼンテーション層の仕様・定義が書かれたファイルの格納フォルダ
  - 参照：[Presentation](/CLAUDE.md#presentation)

## 例外事項

- Domain 層は外部ライブラリに依存しないことを原則とするが、例外として lodash への依存を許可する。
  - 例：`src/Domain/Shared/ValueObject.ts` での `lodash/isEqual` の利用
  - lodash 以外の外部ライブラリには、原則どおり Domain から依存しない。

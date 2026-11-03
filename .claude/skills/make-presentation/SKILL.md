---
name: make-presentation
description: API仕様と Domain / Application を基に Express 5 の Presentation 層とHTTPテストを実装・検証する
---

# make-presentation

## 目的

人間が定義したAPI仕様と Application のユースケースを接続する Express 5.1 の HTTP 層、および HTTP 境界のテストを作成する。

## 手順

1. `CLAUDE.md`、対象ドキュメント、API仕様（存在する場合）を読む。
2. Domain / Application の実装とテスト、既存の Presentation 実装を確認する。
3. エンドポイントごとに HTTP メソッド、パス、認証・認可、入力、検証、呼び出すユースケース、成功レスポンス、エラー応答を対応づける。
4. API仕様が未定義の項目（パス、ステータス、JSON形式、ページング等）があれば、推測で確定せず確認する。
5. Router、Controller / Handler、Request Validator、Response Mapper、Error Middleware 等を適切に分離して実装する。
6. composition root で依存を組み立て、tsyringe の登録と Express アプリへの接続を行う。登録先・起動方式は既存構成に合わせる。
7. `test/Presentation` に HTTP 境界テストを作成する。
8. テスト、型チェック、Lintを実行する。

## 実装ルール

- Express の責務は HTTP アダプターに限定する。
- Controller は入力を検証・変換し、Application のユースケースを呼び、結果を HTTP に変換する。
- Controller から Repository / SQL / Infrastructure の具象クラスを直接呼び出さない。
- Domain モデルをリクエスト・レスポンスとして直接公開しない。
- 入力値は信頼せず、実行時バリデーションを行う。既存の検証ライブラリがなければ、追加前に必要性を検討する。
- Express 5 の Promise rejection の伝播を利用し、エラー処理ミドルウェアでHTTPエラーに変換する。
- 内部例外、SQL、スタックトレース、秘密情報をレスポンスに含めない。
- 認証・認可の実装方針が未定義なら仮実装で済ませず、確認事項にする。
- CORS、レート制限、セキュリティヘッダー等は既存方針・要件に従う。無断で公開範囲を広げない。
- tsyringe の登録は composition root に集約し、Domain / Application にコンテナ参照を持ち込まない。
- テスト容易性のため、Express app の生成と listen 起動を分離する。

## テスト要件

- 成功時の status、headers、body を検証する。
- 不正な入力、必須項目不足、対象なし、業務エラー、予期しない例外を検証する。
- Application の依存はテストダブルに置き換え、HTTP契約に集中する。
- 認証・認可が仕様化されている場合、許可・拒否の両方を検証する。
- テスト間で状態を共有せず、ポートやDI登録を適切に初期化する。

## 完了条件

- 対象APIが Application のユースケースに接続されている。
- HTTP契約が仕様と一致し、エラーが安全に変換される。
- Presentation テストが成功している。
- 依存方向が守られている。

## 報告

エンドポイント一覧、作成ファイル、HTTP契約、DI構成、テスト結果、未確定事項を報告する。

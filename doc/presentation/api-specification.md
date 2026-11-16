# API 仕様書

## 目的

Application 層で定義されたユースケースを実現するためのAPI仕様を定義する。
本システムは Express で実装されるため、WebAPI の仕様と主に利用されるユースケースを定義する。
なお、本ドキュメントではWebAPIの仕様は[openapi.yml](./openapi.yml)に定義しているため、ここではエンドポイント・HTTPメソッドの組み合わせがどのユースケースに紐付いているかだけを定義する。


## WebAPIとユースケースの対応表

| ユースケース | エンドポイント | HTTPメソッド |
|--------------|-----------------|-------------|
| UC-BOOK-001 書籍登録 | /book | POST |
| UC-REVIEW-001 レビューの登録 | /review | POST |
| UC-REVIEW-002 レビューの更新 | /review/{id} | PUT |
| UC-CATALOG-003 レビューの削除 | /review/{id} | DELETE |
| UC-CATALOG-001 書籍推薦 | /book/{isbn}/recommendations | GET |

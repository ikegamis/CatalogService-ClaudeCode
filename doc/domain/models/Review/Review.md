# レビュー（Review）ドメイン集約定義

## ドメイン図

```mermaid
classDiagram
    namespace レビュー集約 {
        class Review {
            <<Aggregate Root>>
            +ReviewId reviewId
            +BookId bookId
            +Name name
            +Rating rating
            +Comment comment
            +extractRecommendedBooks() string[]
            +isTrustworthy(threshold: number) boolean
        }

        class ReviewId {
            <<Value Object>>
            +string value
        }

        class Name {
            <<Value Object>>
            +string value
        }

        class Rating {
            <<Value Object>>
            +number value
            +getQualityFactor() number
        }

        class Comment {
            <<Value Object>>
            +string value
            +extractMatches(pattern: RegExp) string[]
            +getQualityFactor() number
        }
    }
    namespace 書籍集約 {
      class Book
    }
    Book "1" --> "0..n" Review : has

    Review *-- ReviewId
    Review *-- Name
    Review *-- Rating
    Review *-- Comment

    note for Review "extractRecommendedBooks:<br>コメントから前提書籍タイトルを抽出する。<br><br>isTrustworthy:<br>Rating と Comment の品質を組み合わせ、<br>threshold と比較して信頼性を判定する。<br><br>スコア合成式・比較演算子は仮置きで`isTrustworthy`関数を用いる。"
    note for Name "MIN_LENGTH = 1<br>MAX_LENGTH = 50"
    note for Rating "Integer: 1..5<br>qualityFactor = (value - 1) / 4"
    note for Comment "MIN_LENGTH = 1<br>MAX_LENGTH = 1000<br>不適切コメントは作成不要。<br><br>Quality factor:<br>< 10 chars: 0.2<br>10..100 chars: linear 0.2..1.0<br>>= 100 chars: 1.0"
```

## 属性

- `ReviewId`：レビュー識別子。
- `BookId`：レビュー対象書籍の識別子。Book 集約への参照はIDで行う。
- `Name`：投稿者名。
- `Rating`：評価。
- `Comment`：コメント。

## 値オブジェクトと制約

| 属性名 | 値オブジェクト | 値オブジェクトのvalueの型 | 値オブジェクトの値範囲 | NULL許容 |
| ------ | -------------- | ------------------------------ | -------------------- | ----- |
| ReviewId | ○ | string | 26文字 | ✗ |
| BookId | ○ | Book集約の BookId | ― | ✗ |
| Name | ○ | string | 1〜50文字 | ✗ |
| Rating | ✗ | number | 1〜5 | ✗ |
| Comment | ○ | string | 1〜1000文字 | ○ |

※ 文字数は全て string.length プロパティを用いる

### ReviewId の制約

- 一意の識別子(ulid)
- Review は Book 集約全体を内包せず、識別子を保持する
- ulid を生成して格納する

### Name の制約

- ~~前後空白の扱い、使用可能文字、正規化規則は未確定。~~
- 前後空白はTrimする
- 使用可能文字はUTF-8
- 今回はID管理を行わないので Name が同じなら同じユーザーとみなす
- 匿名投稿を許す

### Rating の制約

- `getQualityFactor()` は次の式で 0.0〜1.0 に正規化する。

  `qualityFactor = (value - 1) / (5 - 1)`

  | 評価 | 品質係数 |
  |---:|---:|
  | 1 | 0.00 |
  | 2 | 0.25 |
  | 3 | 0.50 |
  | 4 | 0.75 |
  | 5 | 1.00 |

### Comment

- `getQualityFactor()` はコメント長に基づいて 0.0〜1.0 の範囲で品質を評価する。
  - 10文字未満：0.2
  - 10文字以上100文字未満：0.2から1.0まで線形に増加
  - 100文字以上：1.0
  - 線形区間を上記端点で解釈した場合の式：`0.2 + (length - 10) / 90 * 0.8`
- `extractMatches(pattern: RegExp)` は、指定された正規表現に一致するテキスト部分を抽書籍推薦出する。
- 文字数の数え方（Unicodeコードポイント、UTF-16コード単位、書記素クラスタ等）は未確定。
- 今回は不適切コメントの判定は行わない

## Review の振る舞い

### `updateName(name: string) : void`

- 投稿者名が変更できる

### `editComment(comment: string): void`

- コメントが登録できる
- 既存コメントは上書きされる

### `extractRecommendedBooks(): string[]`

- 機能：レビューコメントから前提書籍のタイトルを抽出する
- 戻り値：前提書籍のタイトルの配列
- アルゴリズム概要：レビューコメント内に書かれている前提書籍名の配列を取得する
- アルゴリズム詳細
  - レビューコメント内から前提書籍を全て抽出して配列化する
    - 前提書籍であるための条件
      - 前提書籍名はコメント内の`『`、`』`で囲まれた文字列
      - 前提書籍名の後の30文字以内にある推薦キーワードがあれば推薦本とみなす
      - 推薦機ワード：`読む`、`読んだ`、`学ぶ`、`学んだ`、`必要`、推奨`、`おすすめ`、`良い`、`いい`,`理解`
  - コメントされた書籍集約オブジェクト配列内に当該書籍名が前提書籍として入っていたら除外する
  - 残った前提書籍名の配列を戻り値とする

### `isTrustworthy(threshold: number = 0.6): boolean`
- 機能：このレビューが信頼できるかを判断
- 戻り値：信頼できる場合は true
- アルゴリズム概要：評価品質とコメント品質を組み合わせて信頼性スコアを計算し、thresholdの比較結果を返す
- アルゴリズム詳細
  - コメントがない場合、評価品質のみで判断する
    - 信頼性スコアを引数 `threshold` と比較し、レビューが信頼できるかを返す
  - 評価の重みを0.7、コメントの重みを0.3とし、`(評価. * 0.7) + (コメント * 0.3) >= threshold` を`信頼性スコア`とする
  - 信頼性スコアを引数 `threshold` と比較し、レビューが信頼できるかを返す

## リポジトリに対する振る舞い

### `save(review: Review): Promise<void>`

- レビューを永続化する

### `update(review: Review): Promise<void>`

- レビューを更新する
 
### `delete(reviewId: ReviewId): Promise<void>`

- レビューを削除する

### `findById(reviewId: ReviewId): Promise<Review | null>`

- レビューをIdから検索する
- 発見したらレビューオブジェクトを返す
- 発見できなかったら null を返す

### `findAllByBookId(bookId: BookId): Promise<Review[]>`

- 特定の書籍に紐付いているレビューを検索する

## 制約

- レビュー集約は一度生成したら削除することはできない
- 1件の Review は1つの BookId を持つ。
- Review は Book 集約を直接保持せず、BookId で参照する。
- 書籍推薦は複数 Review の取得・フィルタリング・集計を伴う。`Review.isTrustworthy` と `Review.extractRecommendedBooks` は個々の Review の振る舞いであり、複数レビューを横断する取得・集計のオーケストレーションを Review 集約に持たせない。

## 未確定事項

- [x] **信頼性スコア**：Rating と Comment の品質係数をどの式・重みで合成するか。
- [x] **閾値**：threshold の有効範囲、設定元、比較演算子。
- [x] **コメント抽出**：前提書籍名を抽出する正規表現・言語表現・誤抽出時の扱い。
- [x] **推薦結果**：同数順位の並び順、上位件数、推薦対象に自分自身（入力 Book）を含めるか。
- [x] **投稿者名**：空白・文字種・匿名投稿の扱い。
- [x] **文字数**：Name、Title、Author、Comment の文字数計測方法。
- [x] **不適切コメント**：不適切表現の定義と検出・拒否の責務。
- [x] **識別子**：ReviewId の生成方式と ReviewId の一意性スコープ。
- [x] **ライフサイクル**：非公開化に関するユースケース。

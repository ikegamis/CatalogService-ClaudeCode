# トランザクションの実装

アプリケーション層がリポジトリ層に対して持つ責務の中に、トランザクション制御がある。
重要な責務なので専用のクラスを作成し、トランザクションの責務をこのクラスに集約して持つこととする。
このファイルではリポジトリを操作する際のトランザクション制御について定義する。

## 要求

- ACID特性を保証すること
  - 原子性(Atomicity)、一貫性(Consistency)、独立性(Isolation)、永続性(Durability)

## 要件

- 要求を満たすためには、以下の機能がある
  - トランザクションの境界制御(BEGIN TRANSACTION, COMMIT, ROLLBACK)
  - 排他制御(またはロック機構)
  - 分離レベルの調整(READ UNCOMMITTED、READ COMMITTED、REPEATABLE READ、SERIALIZABLE)
  - 障害復旧(リカバリ)
- 今回はサンプルプロジェクトなのでトランザクションの境界制御を見たせばアプリケーション層のリポジトリそうに対する責務は満たせばよいこととする

### 排他制御

排他制御に関しては以下の方針を用いることとする。

- 書籍集約：楽観的排他制御
  - 書籍集約はマスターテーブルであり、価格というビジネス上重要な要素を持つことから楽観的排他制御(同時にテーブルを更新した場合、先に更新した方のセッションデータが採用され、後で更新したセッションデータは失敗する)
  - 書籍集約にはバージョンカラム(number型)を追加する
- レビュー集約：後勝ち方式
  - レビューは同一レビューが同時に更新されるようなリスクは非常に少ない上、同時更新のどちらが採用されてもビジネス上、それほど影響はないため運用コストの少ない後が地方式(同時にテーブルを更新した場合、後に更新した方のセッションデータが採用され、先に更新したセッションデータには何も起きない)

## 実装

### インターフェイス

- インフラ層では InMemory と SQL を実装することから、トランザクション管理用のインターフェイスを用意する。
  - このインターフェイスはトランザクション管理用で集約オブジェクトとの結合性はないことから、扱うデータ型は `any` 型ではなく、ジェネリクス型で実装する

例
```typescript
export interface ITransactionManager {
    begin<T>(callback: ()=> Promise<T>): Promise<T>;
}
class ApplicationService {
    constructor(
        private repository: IDomainRepository,
        private transactionManager: ITransactionManager
    )()
    execute(){
        await this.transactionManager.gegin(async () => {
            // ドメインモデルのデータベースへの操作
            this.repository.save();
        });
    }
}
```

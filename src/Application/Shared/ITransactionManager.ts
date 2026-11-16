/**
 * トランザクション境界を制御するポート（.claude/skills/make-application/transaction.md）。
 * 実装は callback の開始前に BEGIN し、callback が正常に完了したら COMMIT、例外を投げたら ROLLBACK して例外を再送出する。
 * 集約に依存しないため、戻り値は any ではなくジェネリクスで受け渡す。
 *
 * callback には接続やトランザクションのハンドルを渡さない。そのため実装は、callback の実行中に呼ばれた
 * リポジトリの操作が同じトランザクション（同じ DB 接続）で実行されるよう、実装側で文脈を引き継ぐ必要がある
 * （例：SQL 実装では AsyncLocalStorage で接続を共有する）。
 */
export interface ITransactionManager {
  begin<T>(callback: () => Promise<T>): Promise<T>;
}

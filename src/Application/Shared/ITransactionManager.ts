/**
 * トランザクション境界を制御するポート（.claude/skills/make-application/transaction.md）。
 * 実装は callback の開始前に BEGIN し、callback が正常に完了したら COMMIT、例外を投げたら ROLLBACK して例外を再送出する。
 * 集約に依存しないため、戻り値は any ではなくジェネリクスで受け渡す。
 */
export interface ITransactionManager {
  begin<T>(callback: () => Promise<T>): Promise<T>;
}

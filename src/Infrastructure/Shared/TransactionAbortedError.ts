/**
 * トランザクション内で書き込みが失敗した後もトランザクションを続けようとしたことを表す技術エラー。
 *
 * PostgreSQL では、トランザクション内で SQL が1つでも失敗するとトランザクションは中断状態になり、
 * 以降の SQL は拒否され、COMMIT はエラーにならずに ROLLBACK として完了する。
 * callback が失敗を catch して正常終了すると「成功したのに何も保存されていない」状態になるため、
 * ITransactionManager の実装はその場合にこのエラーを投げる（InMemory 実装も同じ契約に揃える）。
 */
export class TransactionAbortedError extends Error {
  constructor(
    message = "トランザクション内で失敗した処理があったため、トランザクションはロールバックされました。",
  ) {
    super(message);
    this.name = "TransactionAbortedError";
  }
}

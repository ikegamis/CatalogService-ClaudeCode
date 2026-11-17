import { AsyncLocalStorage } from "node:async_hooks";

import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

import { TransactionAbortedError } from "Infrastructure/Shared/TransactionAbortedError";

/**
 * 接続プールと「いま実行中のトランザクションの接続」を管理する。
 * ITransactionManager.begin の callback には接続が渡されないため、AsyncLocalStorage で接続を引き継ぎ、
 * callback 内で呼ばれたリポジトリの query が同じ接続（同じトランザクション）で実行されるようにする。
 */
export class PostgresDatabase {
  private readonly context = new AsyncLocalStorage<PoolClient>();

  constructor(private readonly pool: Pool) {}

  /** トランザクション内なら同じ接続で、そうでなければプールの任意の接続（自動コミット）で実行する。値は必ずパラメーターで渡す。 */
  query<R extends QueryResultRow>(text: string, values: readonly unknown[] = []): Promise<QueryResult<R>> {
    const client = this.context.getStore();
    return client ? client.query<R>(text, [...values]) : this.pool.query<R>(text, [...values]);
  }

  /**
   * callback を1つのトランザクションで実行する。正常終了なら COMMIT、例外なら ROLLBACK して例外を再送出する。
   * 既にトランザクション内で呼ばれた場合は新たに BEGIN せず、外側のトランザクションに参加する。
   *
   * callback 内で SQL の失敗を catch して正常終了した場合、トランザクションは中断状態のままで、
   * COMMIT はエラーにならずに ROLLBACK として完了する。成功と誤認させないよう TransactionAbortedError を投げる。
   */
  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    if (this.context.getStore()) {
      return callback();
    }
    const client = await this.pool.connect();
    let releaseError: Error | undefined;
    try {
      try {
        await client.query("BEGIN");
      } catch (error) {
        // BEGIN できない接続は状態が不明なので、プールに戻さず破棄する。
        releaseError = toError(error);
        throw error;
      }
      try {
        const result = await this.context.run(client, callback);
        const commit = await client.query("COMMIT");
        if (commit.command === "ROLLBACK") {
          throw new TransactionAbortedError();
        }
        return result;
      } catch (error) {
        try {
          // COMMIT が ROLLBACK として完了した後は、トランザクション外の ROLLBACK（警告のみ）になるが害はない。
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          // ROLLBACK できない接続は状態が不明なので、プールに戻さず破棄する。元の例外を優先して投げる。
          releaseError = toError(rollbackError);
        }
        throw error;
      }
    } finally {
      client.release(releaseError);
    }
  }
}

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

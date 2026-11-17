import { AsyncLocalStorage } from "node:async_hooks";

import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

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
   */
  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    if (this.context.getStore()) {
      return callback();
    }
    const client = await this.pool.connect();
    let releaseError: Error | undefined;
    try {
      await client.query("BEGIN");
      try {
        const result = await this.context.run(client, callback);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          // ROLLBACK できない接続は状態が不明なので、プールに戻さず破棄する。元の例外を優先して投げる。
          releaseError = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
        }
        throw error;
      }
    } finally {
      client.release(releaseError);
    }
  }
}

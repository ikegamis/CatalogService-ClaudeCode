import { AsyncLocalStorage } from "node:async_hooks";

import { TransactionAbortedError } from "Infrastructure/Shared/TransactionAbortedError";

/** 永続化する書籍の値（集約ではなくプリミティブで保持し、取得のたびに集約を再構成する）。 */
export type BookRecord = Readonly<{
  bookId: string;
  title: string;
  author: string;
  price: number;
}>;

/** 永続化するレビューの値。comment が null ならコメントなし。 */
export type ReviewRecord = Readonly<{
  reviewId: string;
  bookId: string;
  name: string;
  rating: number;
  comment: string | null;
}>;

export type Tables = {
  book: Map<string, BookRecord>;
  review: Map<string, ReviewRecord>;
};

/** 実行中のトランザクションの作業用コピーと、書き込みの失敗で中断状態になったかどうか。 */
type TransactionContext = {
  tables: Tables;
  aborted: boolean;
};

const emptyTables = (): Tables => ({ book: new Map(), review: new Map() });

/** レコードは不変（置き換えのみ）なので、Map の浅いコピーでスナップショットになる。 */
const cloneTables = (tables: Tables): Tables => ({
  book: new Map(tables.book),
  review: new Map(tables.review),
});

/**
 * テスト・ローカル用途のインメモリ「データベース」。本番の永続化には使わない（プロセス終了で消える）。
 *
 * SQL 実装と同じポート契約（コミット／ロールバック、トランザクション外からは未コミットの変更が見えない）を満たすため、
 * - トランザクションは作業用コピーに対して実行し、正常終了時にだけ確定データと置き換える。
 * - トランザクション同士は1つずつ直列に実行する（同時に開始された場合は先のものの終了を待つ）。
 * - トランザクション外の書き込みも1件だけのトランザクションとして直列化する（自動コミット相当）。
 * - トランザクション内で書き込みが失敗したら中断状態にし、以降の読み書きと確定を拒否する
 *   （PostgreSQL で SQL が失敗したトランザクションと同じ振る舞い）。
 */
export class InMemoryDatabase {
  private committed: Tables = emptyTables();
  private readonly context = new AsyncLocalStorage<TransactionContext>();
  private queue: Promise<unknown> = Promise.resolve();

  /**
   * callback を1つのトランザクションで実行する。正常終了なら確定、例外なら破棄して例外を再送出する。
   * callback が書き込みの失敗を catch して正常終了した場合は、確定せずに TransactionAbortedError を投げる。
   * 既にトランザクション内で呼ばれた場合は外側のトランザクションに参加する。
   */
  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    if (this.context.getStore()) {
      return callback();
    }
    const run = async (): Promise<T> => {
      const working: TransactionContext = { tables: cloneTables(this.committed), aborted: false };
      const result = await this.context.run(working, callback);
      if (working.aborted) {
        throw new TransactionAbortedError();
      }
      this.committed = working.tables;
      return result;
    };
    const result = this.queue.then(run);
    // 失敗したトランザクションの例外で後続のトランザクションが止まらないよう、待ち行列には結果だけを繋ぐ
    this.queue = result.catch(() => undefined);
    return result;
  }

  /** トランザクション内なら作業用コピーを、外なら確定済みのデータを読む。 */
  read<T>(reader: (tables: Tables) => T): T {
    const current = this.context.getStore();
    if (!current) {
      return reader(this.committed);
    }
    assertActive(current);
    return reader(current.tables);
  }

  /** トランザクション内なら作業用コピーに、外なら1件だけのトランザクションとして書き込む。失敗したらトランザクションを中断状態にする。 */
  async write<T>(writer: (tables: Tables) => T): Promise<T> {
    const current = this.context.getStore();
    if (!current) {
      return this.transaction(async () => this.write(writer));
    }
    assertActive(current);
    try {
      return writer(current.tables);
    } catch (error) {
      current.aborted = true;
      throw error;
    }
  }
}

const assertActive = (context: TransactionContext): void => {
  if (context.aborted) {
    throw new TransactionAbortedError(
      "トランザクションは中断状態のため、トランザクションが終わるまで操作を受け付けません。",
    );
  }
};

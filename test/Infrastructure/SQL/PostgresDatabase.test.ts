import { Pool } from "pg";

import { PostgresDatabase } from "Infrastructure/SQL/PostgresDatabase";
import { TransactionAbortedError } from "Infrastructure/Shared/TransactionAbortedError";

/**
 * 接続を偽物に差し替え、PostgreSQL に接続せずにトランザクション制御（BEGIN / COMMIT / ROLLBACK と接続の返却）を検証する。
 * 実際の PostgreSQL での振る舞いは PostgresRepositories.test.ts（ポート契約）で検証する。
 */
type FakeClient = {
  executed: string[];
  query: jest.Mock;
  release: jest.Mock;
};

const createFake = (respond: (text: string) => Promise<{ command: string; rows: unknown[] }>) => {
  const client: FakeClient = {
    executed: [],
    query: jest.fn(),
    release: jest.fn(),
  };
  client.query.mockImplementation((text: string) => {
    client.executed.push(text);
    return respond(text);
  });
  const pool = { connect: jest.fn().mockResolvedValue(client), query: jest.fn() };
  return { client, database: new PostgresDatabase(pool as unknown as Pool) };
};

const ok = (text: string) => Promise.resolve({ command: text.split(" ")[0].toUpperCase(), rows: [] });

describe("PostgresDatabase.transaction", () => {
  it("正常終了なら BEGIN → callback の SQL → COMMIT を同じ接続で実行し、接続をプールに返す", async () => {
    const { client, database } = createFake(ok);

    const result = await database.transaction(async () => {
      await database.query("SELECT 1");
      return "done";
    });

    expect(result).toBe("done");
    expect(client.executed).toEqual(["BEGIN", "SELECT 1", "COMMIT"]);
    expect(client.release).toHaveBeenCalledWith(undefined);
  });

  it("COMMIT が ROLLBACK として完了した（中断状態だった）場合は、成功扱いにせず TransactionAbortedError を投げる", async () => {
    const { client, database } = createFake((text) =>
      text === "COMMIT" ? Promise.resolve({ command: "ROLLBACK", rows: [] }) : ok(text),
    );

    await expect(database.transaction(async () => "成功したつもり")).rejects.toBeInstanceOf(TransactionAbortedError);
    // 接続自体は正常なのでプールに返す
    expect(client.release).toHaveBeenCalledWith(undefined);
  });

  it("callback が例外を投げたら ROLLBACK して同じ例外を再送出し、接続をプールに返す", async () => {
    const { client, database } = createFake(ok);
    const failure = new Error("失敗");

    await expect(database.transaction(() => Promise.reject(failure))).rejects.toBe(failure);

    expect(client.executed).toEqual(["BEGIN", "ROLLBACK"]);
    expect(client.release).toHaveBeenCalledWith(undefined);
  });

  it("ROLLBACK にも失敗した接続は、元の例外を投げたうえでプールに戻さず破棄する", async () => {
    const rollbackError = new Error("ROLLBACK 失敗");
    const { client, database } = createFake((text) => (text === "ROLLBACK" ? Promise.reject(rollbackError) : ok(text)));
    const failure = new Error("失敗");

    await expect(database.transaction(() => Promise.reject(failure))).rejects.toBe(failure);

    expect(client.release).toHaveBeenCalledWith(rollbackError);
  });

  it("BEGIN に失敗した接続は、callback を実行せずにプールに戻さず破棄する", async () => {
    const beginError = new Error("BEGIN 失敗");
    const { client, database } = createFake((text) => (text === "BEGIN" ? Promise.reject(beginError) : ok(text)));
    const callback = jest.fn();

    await expect(database.transaction(callback)).rejects.toBe(beginError);

    expect(callback).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledWith(beginError);
  });
});

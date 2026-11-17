import {
  CONNECTION_TIMEOUT_MILLIS,
  IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MILLIS,
  IDLE_TIMEOUT_MILLIS,
  LOCK_TIMEOUT_MILLIS,
  loadDatabaseConfig,
  POOL_MAX,
  QUERY_TIMEOUT_MILLIS,
  STATEMENT_TIMEOUT_MILLIS,
} from "Infrastructure/SQL/DatabaseConfig";

const ENV = {
  POSTGRES_HOST: "localhost",
  POSTGRES_PORT: "5432",
  POSTGRES_DB: "app",
  POSTGRES_USER: "user",
  POSTGRES_PASSWORD: "secret",
};

describe("loadDatabaseConfig", () => {
  it("環境変数から接続設定を組み立てる", () => {
    expect(loadDatabaseConfig(ENV)).toMatchObject({
      host: "localhost",
      port: 5432,
      database: "app",
      user: "user",
      password: "secret",
    });
  });

  it("プールの最大接続数と、接続・SQL 文・ロック待ち・応答待ち・トランザクション放置のタイムアウトを設定する", () => {
    expect(loadDatabaseConfig(ENV)).toMatchObject({
      max: POOL_MAX,
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MILLIS,
      idleTimeoutMillis: IDLE_TIMEOUT_MILLIS,
      statement_timeout: STATEMENT_TIMEOUT_MILLIS,
      lock_timeout: LOCK_TIMEOUT_MILLIS,
      query_timeout: QUERY_TIMEOUT_MILLIS,
      idle_in_transaction_session_timeout: IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MILLIS,
    });
  });

  it("サーバー側の statement_timeout がクライアント側の query_timeout より先に効き、ロック待ちは SQL 文の上限内で打ち切られる", () => {
    expect(LOCK_TIMEOUT_MILLIS).toBeLessThan(STATEMENT_TIMEOUT_MILLIS);
    expect(STATEMENT_TIMEOUT_MILLIS).toBeLessThan(QUERY_TIMEOUT_MILLIS);
  });

  it("database を指定すると POSTGRES_DB の代わりに使う", () => {
    expect(loadDatabaseConfig(ENV, { database: "app_test" }).database).toBe("app_test");
  });

  it("必須の環境変数が欠けていれば、欠けている変数名を示して失敗する（値は含めない）", () => {
    const { POSTGRES_PASSWORD: _omit, ...rest } = ENV;
    expect(() => loadDatabaseConfig({ ...rest, POSTGRES_HOST: "" })).toThrow(
      "データベース接続用の環境変数が設定されていません: POSTGRES_HOST, POSTGRES_PASSWORD",
    );
  });

  it.each(["abc", "0", "-1", "1.5"])("POSTGRES_PORT が %s なら失敗する", (port) => {
    expect(() => loadDatabaseConfig({ ...ENV, POSTGRES_PORT: port })).toThrow("POSTGRES_PORT");
  });
});

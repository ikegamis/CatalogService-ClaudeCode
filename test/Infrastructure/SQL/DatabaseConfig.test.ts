import { loadDatabaseConfig } from "Infrastructure/SQL/DatabaseConfig";

const ENV = {
  POSTGRES_HOST: "localhost",
  POSTGRES_PORT: "5432",
  POSTGRES_DB: "app",
  POSTGRES_USER: "user",
  POSTGRES_PASSWORD: "secret",
};

describe("loadDatabaseConfig", () => {
  it("環境変数から接続設定を組み立て、タイムアウトを設定する", () => {
    expect(loadDatabaseConfig(ENV)).toMatchObject({
      host: "localhost",
      port: 5432,
      database: "app",
      user: "user",
      password: "secret",
      connectionTimeoutMillis: expect.any(Number),
      idleTimeoutMillis: expect.any(Number),
    });
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

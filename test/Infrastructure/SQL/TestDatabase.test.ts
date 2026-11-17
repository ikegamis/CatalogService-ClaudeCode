import { assertPostgresVersion, resolveDescribeSql } from "./TestDatabase";

/** SQL 統合テストの実行条件（PostgreSQL に接続せずに検証する）。 */
describe("SQL 統合テストの実行条件", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("POSTGRES_HOST が設定されていれば実行する", () => {
    expect(resolveDescribeSql({ POSTGRES_HOST: "db" })).toBe(describe);
  });

  it("POSTGRES_HOST が未設定ならスキップする", () => {
    expect(resolveDescribeSql({})).toBe(describe.skip);
  });

  it("REQUIRE_SQL_TESTS=1 で POSTGRES_HOST が未設定なら、スキップせずに失敗させる", () => {
    expect(() => resolveDescribeSql({ REQUIRE_SQL_TESTS: "1" })).toThrow("REQUIRE_SQL_TESTS=1");
  });

  it.each(["170000", "170006"])("PostgreSQL 17（server_version_num %s）なら通す", (version) => {
    expect(() => assertPostgresVersion(version)).not.toThrow();
  });

  it.each(["150010", "160004", "180000"])("PostgreSQL 17 以外（server_version_num %s）なら失敗させる", (version) => {
    expect(() => assertPostgresVersion(version)).toThrow("PostgreSQL 17");
  });
});

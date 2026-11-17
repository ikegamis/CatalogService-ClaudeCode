import { Pool } from "pg";

import { createPool, loadDatabaseConfig } from "Infrastructure/SQL/DatabaseConfig";
import { migrate } from "Infrastructure/SQL/migrations";

/**
 * SQL 統合テスト用のデータベース。開発用データベース（POSTGRES_DB）とは別に作り、そこにだけスキーマを適用・データを削除する。
 * 名前は POSTGRES_TEST_DB で上書きできる（既定は `${POSTGRES_DB}_test`）。
 */
export const testDatabaseName = (): string => process.env.POSTGRES_TEST_DB ?? `${process.env.POSTGRES_DB}_test`;

/** POSTGRES_HOST が未設定の環境（DB なし）では SQL 統合テストを実行しない。設定済みで接続できない場合は失敗させる。 */
export const describeSql: jest.Describe = process.env.POSTGRES_HOST ? describe : describe.skip;
if (!process.env.POSTGRES_HOST) {
  console.warn("POSTGRES_HOST が未設定のため、PostgreSQL 統合テストを実行しません。");
}

const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/** テスト用データベースがなければ作成し、スキーマを適用した接続プールを返す。 */
export const setupTestDatabase = async (): Promise<Pool> => {
  const name = testDatabaseName();
  // CREATE DATABASE は識別子をパラメーター化できないため、許可した文字だけで構成された名前に限定する
  if (!SAFE_IDENTIFIER.test(name)) {
    throw new Error(`テスト用データベース名が不正です: ${name}`);
  }
  if (name === process.env.POSTGRES_DB) {
    throw new Error("テスト用データベースは開発用データベース（POSTGRES_DB）と別の名前にしてください。");
  }

  const admin = createPool(loadDatabaseConfig());
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await admin.end();
  }

  const pool = createPool(loadDatabaseConfig(process.env, { database: name }));
  await migrate(pool);
  return pool;
};

/** テストごとに独立したデータ状態にする。 */
export const truncateAll = async (pool: Pool): Promise<void> => {
  await pool.query("TRUNCATE review, book");
};

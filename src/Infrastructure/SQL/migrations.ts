import { readFile } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

import { createPool, loadDatabaseConfig } from "./DatabaseConfig";
import { PostgresDatabase } from "./PostgresDatabase";

/** スキーマ定義の正（このファイルと同じディレクトリの schema.sql）。 */
export const SCHEMA_FILE = path.join(__dirname, "schema.sql");

/**
 * schema.sql を1つのトランザクションで適用する（前進のみ）。
 * schema.sql は IF NOT EXISTS で書かれているため、既に適用済みのデータベースに再実行しても既存データは変わらない。
 * ロールバック（テーブル削除）は既存データを破壊するため、ここでは提供しない（schema.sql 冒頭の手順を参照）。
 */
export const migrate = async (pool: Pool): Promise<void> => {
  const sql = await readFile(SCHEMA_FILE, "utf8");
  const database = new PostgresDatabase(pool);
  // 同時に複数のプロセスから実行されても DDL が衝突しないよう、トランザクション単位の勧告ロックで直列化する。
  // schema.sql は複数文からなるため、パラメーターなし（単純クエリプロトコル）で送る。
  await database.transaction(async () => {
    await database.query("SELECT pg_advisory_xact_lock(hashtext('catalog_schema_migration'))");
    await database.query(sql);
  });
};

/**
 * CLI: `npx ts-node src/Infrastructure/SQL/migrations.ts`
 * 接続先は環境変数（POSTGRES_HOST など）で指定する。既存のデータベースに適用するため、実行前に接続先を確認すること。
 */
if (require.main === module) {
  const pool = createPool(loadDatabaseConfig());
  migrate(pool)
    .then(() => console.log("スキーマを適用しました。"))
    .catch((error: unknown) => {
      console.error("スキーマの適用に失敗しました:", error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

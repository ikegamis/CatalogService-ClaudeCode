import "reflect-metadata";

import { createPool, loadDatabaseConfig } from "Infrastructure/SQL/DatabaseConfig";

import { createApp } from "./app";
import { createPostgresContainer, resolveControllers } from "./CompositionRoot";

/**
 * 起動エントリ: `npx ts-node src/Presentation/Express/index.ts`
 * 接続先は環境変数（POSTGRES_HOST など）で指定する。スキーマは事前に src/Infrastructure/SQL/migrations.ts で適用しておく。
 * 待ち受けポートは PORT（省略時は compose.yml で公開している 3000）。
 */
const DEFAULT_PORT = 3000;

const port = process.env.PORT === undefined ? DEFAULT_PORT : Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT は正の整数である必要があります。");
}

const pool = createPool(loadDatabaseConfig());
const app = createApp(resolveControllers(createPostgresContainer(pool)));
const server = app.listen(port, () => {
  console.log(`CatalogService を起動しました（port: ${port}）。`);
});

/** 処理中のリクエストを終えてから接続プールを閉じる。 */
const shutdown = (): void => {
  server.close(() => {
    pool.end().catch((error: unknown) => {
      console.error("接続プールの終了に失敗しました:", error instanceof Error ? error.message : error);
    });
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

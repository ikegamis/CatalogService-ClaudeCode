import "reflect-metadata";

import { createPool, loadDatabaseConfig } from "Infrastructure/SQL/DatabaseConfig";

import { createApp } from "./app";
import { createPostgresContainer, resolveControllers } from "./CompositionRoot";
import { createGracefulShutdown } from "./GracefulShutdown";

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

const shutdown = createGracefulShutdown(server, pool);
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

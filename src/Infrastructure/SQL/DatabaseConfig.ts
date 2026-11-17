import { Pool, PoolConfig } from "pg";

/** 接続先の必須環境変数。接続文字列や秘密情報はコードに埋め込まず、環境変数から受け取る。 */
const REQUIRED_KEYS = ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"] as const;

/** 接続取得の待ち時間。DB が応答しないときに要求を無期限に待たせないため。 */
const CONNECTION_TIMEOUT_MILLIS = 5_000;
/** 使われていない接続をプールから閉じるまでの時間。 */
const IDLE_TIMEOUT_MILLIS = 10_000;

/**
 * 環境変数から接続設定を組み立てる。必須の値が欠けていれば起動時に失敗させる（値そのものはメッセージに含めない）。
 * database を指定すると POSTGRES_DB の代わりに使う（統合テスト用の別データベースなど）。
 */
export const loadDatabaseConfig = (
  env: NodeJS.ProcessEnv = process.env,
  overrides: { database?: string } = {},
): PoolConfig => {
  const missing = REQUIRED_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`データベース接続用の環境変数が設定されていません: ${missing.join(", ")}`);
  }
  const port = Number(env.POSTGRES_PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("POSTGRES_PORT は正の整数である必要があります。");
  }
  return {
    host: env.POSTGRES_HOST,
    port,
    database: overrides.database ?? env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MILLIS,
    idleTimeoutMillis: IDLE_TIMEOUT_MILLIS,
  };
};

/**
 * 接続プールを生成する。
 * アイドル中の接続で起きたエラー（DB 再起動など）はプールが接続を破棄して回復するが、
 * 'error' のリスナーがないとプロセスが落ちるため登録する。ログには接続情報を含めない。
 */
export const createPool = (config: PoolConfig): Pool => {
  const pool = new Pool(config);
  pool.on("error", (error) => {
    console.error(`PostgreSQL のアイドル接続でエラーが発生しました: ${error.message}`);
  });
  return pool;
};

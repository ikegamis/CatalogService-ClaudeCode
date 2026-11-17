import { Pool, PoolConfig } from "pg";

/** 接続先の必須環境変数。接続文字列や秘密情報はコードに埋め込まず、環境変数から受け取る。 */
const REQUIRED_KEYS = ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"] as const;

/*
 * プールとタイムアウトの設定値。運用要件が未定義のため、いずれも仮の値（運用要件が決まったら見直す）。
 * いずれも「DB が応答しない・ロックが解けないときに、接続とリクエストを無期限に占有させない」ためのもの。
 */
/** プールの最大接続数（仮。pg の既定値と同じ）。 */
export const POOL_MAX = 10;
/** 接続取得の待ち時間（仮）。 */
export const CONNECTION_TIMEOUT_MILLIS = 5_000;
/** 使われていない接続をプールから閉じるまでの時間（仮）。 */
export const IDLE_TIMEOUT_MILLIS = 10_000;
/** サーバー側で1つの SQL 文の実行を打ち切るまでの時間（仮）。 */
export const STATEMENT_TIMEOUT_MILLIS = 10_000;
/** 行ロックなどの取得を待つ時間（仮）。後勝ちの UPDATE が先行トランザクションを待つ上限になる。 */
export const LOCK_TIMEOUT_MILLIS = 5_000;
/**
 * クライアント側で応答を待つ時間（仮）。サーバーが応答しない（ネットワーク断など）場合の保険。
 * 通常はサーバー側の statement_timeout が先に効くよう、それより長くする。
 */
export const QUERY_TIMEOUT_MILLIS = 15_000;
/** トランザクション中のまま何もしない接続をサーバーが切断するまでの時間（仮）。トランザクションの閉じ忘れ対策。 */
export const IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MILLIS = 60_000;

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
    max: POOL_MAX,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MILLIS,
    idleTimeoutMillis: IDLE_TIMEOUT_MILLIS,
    statement_timeout: STATEMENT_TIMEOUT_MILLIS,
    lock_timeout: LOCK_TIMEOUT_MILLIS,
    query_timeout: QUERY_TIMEOUT_MILLIS,
    idle_in_transaction_session_timeout: IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MILLIS,
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

/** 停止処理が扱う HTTP サーバーの操作（node:http の Server が満たす）。 */
export type ClosableServer = {
  close(callback: (error?: Error) => void): unknown;
  closeAllConnections(): void;
};

/** 停止処理が扱う接続プールの操作（pg の Pool が満たす）。 */
export type ClosablePool = {
  end(): Promise<void>;
};

/** 処理中のリクエストの完了を待つ上限（ミリ秒）。運用要件は未定義のため仮の値。 */
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5_000;

/**
 * 処理中のリクエストを終えてから接続プールを閉じる停止処理を返す。
 * - 何度呼ばれても停止処理は1回だけ行う（SIGTERM と SIGINT が続けて届いた場合に、処理中のリクエストより先にプールを閉じないため）。
 * - timeoutMs を過ぎても終わらないリクエストは接続ごと切断し、そのうえでプールを閉じる。
 */
export const createGracefulShutdown = (
  server: ClosableServer,
  pool: ClosablePool,
  timeoutMs: number = DEFAULT_SHUTDOWN_TIMEOUT_MS,
): (() => void) => {
  let started = false;

  return () => {
    if (started) {
      return;
    }
    started = true;

    // 停止待ちのためだけにプロセスを生かし続けないよう unref する
    const timer = setTimeout(() => {
      console.error(`停止処理が ${timeoutMs} ミリ秒以内に終わらないため、残っている接続を切断します。`);
      server.closeAllConnections();
    }, timeoutMs);
    timer.unref();

    server.close((error) => {
      clearTimeout(timer);
      if (error) {
        console.error("HTTP サーバーの停止に失敗しました:", error.message);
      }
      pool.end().catch((endError: unknown) => {
        console.error("接続プールの終了に失敗しました:", endError instanceof Error ? endError.message : endError);
      });
    });
  };
};

import { ClosablePool, ClosableServer, createGracefulShutdown } from "Presentation/Express/GracefulShutdown";

/** close のコールバックを、テストから任意の時点で呼べる（= 処理中のリクエストが終わった時点を再現する）サーバー。 */
const createServer = () => {
  const callbacks: Array<(error?: Error) => void> = [];
  const server = {
    close: jest.fn((callback: (error?: Error) => void) => {
      callbacks.push(callback);
    }),
    closeAllConnections: jest.fn(() => {
      // 接続を切断すると close が完了する（node:http の挙動）
      callbacks.splice(0).forEach((callback) => callback());
    }),
  } satisfies ClosableServer;
  const finishRequests = () => callbacks.splice(0).forEach((callback) => callback());
  return { server, finishRequests };
};

const createPool = () => ({ end: jest.fn<Promise<void>, []>().mockResolvedValue(undefined) }) satisfies ClosablePool;

describe("createGracefulShutdown", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
    jest.useRealTimers();
  });

  it("処理中のリクエストが終わるまで接続プールを閉じない", () => {
    const { server, finishRequests } = createServer();
    const pool = createPool();

    createGracefulShutdown(server, pool, 5_000)();

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(pool.end).not.toHaveBeenCalled();

    finishRequests();

    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(server.closeAllConnections).not.toHaveBeenCalled();
  });

  it("2回呼ばれても（SIGTERM の後に SIGINT など）停止処理は1回だけで、処理中のリクエストより先にプールを閉じない", () => {
    const { server, finishRequests } = createServer();
    const pool = createPool();
    const shutdown = createGracefulShutdown(server, pool, 5_000);

    shutdown();
    shutdown();

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(pool.end).not.toHaveBeenCalled();

    finishRequests();

    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it("タイムアウトまでに終わらないリクエストは接続ごと切断し、その後でプールを閉じる", () => {
    const { server } = createServer();
    const pool = createPool();

    createGracefulShutdown(server, pool, 5_000)();

    jest.advanceTimersByTime(4_999);
    expect(server.closeAllConnections).not.toHaveBeenCalled();
    expect(pool.end).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(server.closeAllConnections).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
  });

  it("既定のタイムアウトは 5 秒", () => {
    const { server } = createServer();
    const pool = createPool();

    createGracefulShutdown(server, pool)();

    jest.advanceTimersByTime(4_999);
    expect(server.closeAllConnections).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(server.closeAllConnections).toHaveBeenCalledTimes(1);
  });

  it("タイムアウト前に終わった場合はタイマーを解除し、後から切断しない", () => {
    const { server, finishRequests } = createServer();
    const pool = createPool();

    createGracefulShutdown(server, pool, 5_000)();
    finishRequests();
    jest.advanceTimersByTime(10_000);

    expect(server.closeAllConnections).not.toHaveBeenCalled();
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it("接続プールの終了に失敗しても例外を投げず、記録する", async () => {
    const { server, finishRequests } = createServer();
    const pool = { end: jest.fn<Promise<void>, []>().mockRejectedValue(new Error("end failed")) };

    createGracefulShutdown(server, pool, 5_000)();
    finishRequests();
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleError).toHaveBeenCalledWith("接続プールの終了に失敗しました:", "end failed");
  });
});

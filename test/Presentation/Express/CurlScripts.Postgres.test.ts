import { ChildProcess, execFile, spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";

import { Pool } from "pg";

import { describeSql, setupTestDatabase, testDatabaseName, truncateAll } from "../../Infrastructure/SQL/TestDatabase";

/**
 * 本番と同じ起動方法（ts-node で src/Presentation/Express/index.ts を起動）でサーバーを立ち上げ、
 * scripts/curl の curl スクリプトを実行して、すべての検証が成功することを確認する。
 *
 * Jest は ts-jest で変換するため、ts-node だけで起きる問題（tsconfig の target が ES5 になり、
 * Error を継承したクラスの instanceof が失敗するなど）は他のテストでは検出できない。それを補うためのテスト。
 *
 * 接続先は統合テスト用データベース（TestDatabase.ts）。開発用データベースには接続しない。
 * curl がない環境では、SQL 統合テストを実行する設定でも黙ってスキップせずに失敗させる。
 */
const ROOT = path.resolve(__dirname, "../../..");
const SCRIPTS = path.join(ROOT, "scripts/curl");
const TS_NODE = require.resolve("ts-node/dist/bin.js");
const ENTRY = path.join(ROOT, "src/Presentation/Express/index.ts");

/** ts-node は起動時にプロジェクト全体を型検査するため、起動待ちを長めにとる。 */
const STARTUP_TIMEOUT_MS = 60_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

type ScriptResult = { code: number; output: string };

/** OS に空いているポートを割り当てさせる。 */
const findFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => (typeof address === "object" && address ? resolve(address.port) : reject(new Error("port"))));
    });
  });

const run = (file: string, args: string[], env: NodeJS.ProcessEnv): Promise<ScriptResult> =>
  new Promise((resolve) => {
    execFile(file, args, { cwd: ROOT, env, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error === null ? 0 : typeof error.code === "number" ? error.code : 1;
      resolve({ code, output: `${stdout}${stderr}` });
    });
  });

/** サーバーの標準出力・標準エラーを溜めつつ、起動完了の行が出るまで待つ。 */
const startServer = (port: number, logs: string[]): Promise<ChildProcess> =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [TS_NODE, ENTRY], {
      cwd: ROOT,
      env: { ...process.env, POSTGRES_DB: testDatabaseName(), PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`サーバーが ${STARTUP_TIMEOUT_MS} ミリ秒以内に起動しませんでした。\n${logs.join("")}`));
    }, STARTUP_TIMEOUT_MS);
    const onData = (chunk: Buffer) => {
      logs.push(chunk.toString("utf8"));
      if (logs.join("").includes("CatalogService を起動しました")) {
        clearTimeout(timer);
        resolve(child);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", (chunk: Buffer) => logs.push(chunk.toString("utf8")));
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      reject(new Error(`サーバーが起動中に終了しました（code: ${code}, signal: ${signal}）。\n${logs.join("")}`));
    });
  });

/** SIGTERM で停止させる（graceful shutdown）。終わらなければ強制終了する。 */
const stopServer = (child: ChildProcess): Promise<void> =>
  new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    const timer = setTimeout(() => child.kill("SIGKILL"), SHUTDOWN_TIMEOUT_MS);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });

/** 失敗時に原因が分かるよう、スクリプトの出力をそのままメッセージに含める。 */
const expectScriptSucceeded = (result: ScriptResult): void => {
  if (result.code !== 0) {
    throw new Error(`curl スクリプトが終了コード ${result.code} で失敗しました。\n${result.output}`);
  }
  expect(result.output).toContain("すべての検証に成功しました。");
};

describeSql("curl スクリプト（ts-node で起動した実サーバー + PostgreSQL）", () => {
  let pool: Pool;
  let server: ChildProcess | undefined;
  let baseUrl: string;
  const serverLogs: string[] = [];

  beforeAll(async () => {
    const curl = await run("curl", ["--version"], process.env);
    if (curl.code !== 0) {
      throw new Error("curl が見つかりません。curl をインストールしてから実行してください。");
    }
    pool = await setupTestDatabase();
    await truncateAll(pool);
    const port = await findFreePort();
    baseUrl = `http://127.0.0.1:${port}`;
    server = await startServer(port, serverLogs);
  }, STARTUP_TIMEOUT_MS + 30_000);

  afterAll(async () => {
    if (server) {
      await stopServer(server);
    }
    if (pool) {
      await truncateAll(pool);
      await pool.end();
    }
  }, SHUTDOWN_TIMEOUT_MS + 10_000);

  // 各スクリプトは DB が空の状態から実行する前提
  beforeEach(async () => {
    await truncateAll(pool);
  });

  const env = (): NodeJS.ProcessEnv => ({ ...process.env, BASE_URL: baseUrl });

  it("usecases.sh：各ユースケースの検証がすべて成功する", async () => {
    expectScriptSucceeded(await run("sh", [path.join(SCRIPTS, "usecases.sh")], env()));
  }, 60_000);

  it("story.sh：正常系・異常系のストーリーの検証がすべて成功する", async () => {
    expectScriptSucceeded(await run("sh", [path.join(SCRIPTS, "story.sh")], env()));
  }, 60_000);

  it("story.sh：DB が空でない状態で実行すると、終了コード 2 で中断する", async () => {
    await run("sh", [path.join(SCRIPTS, "story.sh"), "normal"], env());

    const rerun = await run("sh", [path.join(SCRIPTS, "story.sh"), "normal"], env());

    expect(rerun.code).toBe(2);
    expect(rerun.output).toContain("このスクリプトは DB が空の状態から実行してください。");
  }, 60_000);

  it("スクリプトの実行中、サーバーは業務エラー・入力エラーを予期しないエラーとして記録していない", () => {
    // ts-node で Error を継承したクラスの instanceof が失敗すると、ここに記録される
    expect(serverLogs.join("")).not.toContain("予期しないエラーが発生しました");
  });
});

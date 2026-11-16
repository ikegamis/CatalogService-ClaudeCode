import { ITransactionManager } from "Application/Shared/ITransactionManager";

/**
 * トランザクション境界の呼び出しを記録するテストダブル。
 * callback が正常終了したら commit、例外なら rollback を記録して例外を再送出する（ポートの契約）。
 */
export class FakeTransactionManager implements ITransactionManager {
  readonly events: string[] = [];
  private active = false;

  get inTransaction(): boolean {
    return this.active;
  }

  async begin<T>(callback: () => Promise<T>): Promise<T> {
    this.events.push("begin");
    this.active = true;
    try {
      const result = await callback();
      this.events.push("commit");
      return result;
    } catch (error) {
      this.events.push("rollback");
      throw error;
    } finally {
      this.active = false;
    }
  }
}

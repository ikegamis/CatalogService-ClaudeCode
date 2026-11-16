import { ITransactionManager } from "Application/Shared/ITransactionManager";

import { InMemoryDatabase } from "./InMemoryDatabase";

/** ITransactionManager のインメモリ実装（テスト・ローカル用途）。トランザクションは直列に実行される。 */
export class InMemoryTransactionManager implements ITransactionManager {
  constructor(private readonly database: InMemoryDatabase) {}

  begin<T>(callback: () => Promise<T>): Promise<T> {
    return this.database.transaction(callback);
  }
}

import { ITransactionManager } from "Application/Shared/ITransactionManager";

import { PostgresDatabase } from "./PostgresDatabase";

/**
 * ITransactionManager の PostgreSQL 実装。分離レベルは PostgreSQL の既定（READ COMMITTED）。
 * 同じ PostgresDatabase を共有するリポジトリは、begin の callback 内で同じ接続を使う。
 */
export class PostgresTransactionManager implements ITransactionManager {
  constructor(private readonly database: PostgresDatabase) {}

  begin<T>(callback: () => Promise<T>): Promise<T> {
    return this.database.transaction(callback);
  }
}

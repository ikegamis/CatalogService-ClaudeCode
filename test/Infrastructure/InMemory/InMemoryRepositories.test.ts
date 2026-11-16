import { InMemoryBookRepository } from "Infrastructure/InMemory/InMemoryBookRepository";
import { InMemoryDatabase } from "Infrastructure/InMemory/InMemoryDatabase";
import { InMemoryReviewRepository } from "Infrastructure/InMemory/InMemoryReviewRepository";
import { InMemoryTransactionManager } from "Infrastructure/InMemory/InMemoryTransactionManager";

import { describeRepositoryContract } from "../Contract/RepositoryContract";

describe("InMemory 実装のポート契約", () => {
  describeRepositoryContract(async () => {
    const database = new InMemoryDatabase();
    return {
      bookRepository: new InMemoryBookRepository(database),
      reviewRepository: new InMemoryReviewRepository(database),
      transactionManager: new InMemoryTransactionManager(database),
    };
  });
});

import { DependencyContainer, container as rootContainer, instanceCachingFactory } from "tsyringe";
import { Pool } from "pg";

import { IBookRepository } from "Domain/Models/Book/IBookRepository";
import { IReviewRepository } from "Domain/Models/Review/IReviewRepository";
import { BookRecommendationService } from "Domain/Services/BookRecommendationService";
import { RecommendBooksService } from "Application/Services/Book/RecommendBooksService";
import { RegisterBookService } from "Application/Services/Book/RegisterBookService";
import { DeleteReviewService } from "Application/Services/Review/DeleteReviewService";
import { RegisterReviewService } from "Application/Services/Review/RegisterReviewService";
import { UpdateReviewService } from "Application/Services/Review/UpdateReviewService";
import { ITransactionManager } from "Application/Shared/ITransactionManager";
import { InMemoryBookRepository } from "Infrastructure/InMemory/InMemoryBookRepository";
import { InMemoryDatabase } from "Infrastructure/InMemory/InMemoryDatabase";
import { InMemoryReviewRepository } from "Infrastructure/InMemory/InMemoryReviewRepository";
import { InMemoryTransactionManager } from "Infrastructure/InMemory/InMemoryTransactionManager";
import { PostgresBookRepository } from "Infrastructure/SQL/PostgresBookRepository";
import { PostgresDatabase } from "Infrastructure/SQL/PostgresDatabase";
import { PostgresReviewRepository } from "Infrastructure/SQL/PostgresReviewRepository";
import { PostgresTransactionManager } from "Infrastructure/SQL/PostgresTransactionManager";

import { Controllers } from "./app";
import { BookController } from "./Controllers/BookController";
import { ReviewController } from "./Controllers/ReviewController";

/**
 * composition root。tsyringe の登録はこのファイルに集約し、Domain / Application / Controller にはコンテナを持ち込まない。
 * Domain / Application のクラスにはデコレーターを付けないため、すべてファクトリで登録する。
 * いずれもステートレスか接続を共有するため、コンテナごとに1つのインスタンス（instanceCachingFactory）とする。
 */
export const Tokens = {
  BookRepository: Symbol("IBookRepository"),
  ReviewRepository: Symbol("IReviewRepository"),
  TransactionManager: Symbol("ITransactionManager"),
} as const;

type Infrastructure = {
  bookRepository: IBookRepository;
  reviewRepository: IReviewRepository;
  transactionManager: ITransactionManager;
};

/** ポートの実装を登録した新しいコンテナを返す。リポジトリとトランザクション管理は同じデータベースを共有する。 */
const createContainer = (createInfrastructure: () => Infrastructure): DependencyContainer => {
  const container = rootContainer.createChildContainer();
  const infrastructure = instanceCachingFactory<Infrastructure>(() => createInfrastructure());
  container.register<IBookRepository>(Tokens.BookRepository, {
    useFactory: (c) => infrastructure(c).bookRepository,
  });
  container.register<IReviewRepository>(Tokens.ReviewRepository, {
    useFactory: (c) => infrastructure(c).reviewRepository,
  });
  container.register<ITransactionManager>(Tokens.TransactionManager, {
    useFactory: (c) => infrastructure(c).transactionManager,
  });
  registerApplication(container);
  return container;
};

/** PostgreSQL 実装で組み立てる（本番用）。pool の生成・終了は呼び出し側が管理する。 */
export const createPostgresContainer = (pool: Pool): DependencyContainer =>
  createContainer(() => {
    const database = new PostgresDatabase(pool);
    return {
      bookRepository: new PostgresBookRepository(database),
      reviewRepository: new PostgresReviewRepository(database),
      transactionManager: new PostgresTransactionManager(database),
    };
  });

/** インメモリ実装で組み立てる（テスト・ローカル用途。プロセス終了でデータは消える）。 */
export const createInMemoryContainer = (): DependencyContainer =>
  createContainer(() => {
    const database = new InMemoryDatabase();
    return {
      bookRepository: new InMemoryBookRepository(database),
      reviewRepository: new InMemoryReviewRepository(database),
      transactionManager: new InMemoryTransactionManager(database),
    };
  });

const registerApplication = (container: DependencyContainer): void => {
  const bookRepository = (c: DependencyContainer) => c.resolve<IBookRepository>(Tokens.BookRepository);
  const reviewRepository = (c: DependencyContainer) => c.resolve<IReviewRepository>(Tokens.ReviewRepository);
  const transactionManager = (c: DependencyContainer) => c.resolve<ITransactionManager>(Tokens.TransactionManager);

  container.register(BookRecommendationService, {
    useFactory: instanceCachingFactory((c) => new BookRecommendationService(bookRepository(c), reviewRepository(c))),
  });
  container.register(RegisterBookService, {
    useFactory: instanceCachingFactory((c) => new RegisterBookService(bookRepository(c), transactionManager(c))),
  });
  container.register(RecommendBooksService, {
    useFactory: instanceCachingFactory((c) => new RecommendBooksService(c.resolve(BookRecommendationService))),
  });
  container.register(RegisterReviewService, {
    useFactory: instanceCachingFactory(
      (c) => new RegisterReviewService(bookRepository(c), reviewRepository(c), transactionManager(c)),
    ),
  });
  container.register(UpdateReviewService, {
    useFactory: instanceCachingFactory((c) => new UpdateReviewService(reviewRepository(c), transactionManager(c))),
  });
  container.register(DeleteReviewService, {
    useFactory: instanceCachingFactory((c) => new DeleteReviewService(reviewRepository(c), transactionManager(c))),
  });
  container.register(BookController, {
    useFactory: instanceCachingFactory(
      (c) => new BookController(c.resolve(RegisterBookService), c.resolve(RecommendBooksService)),
    ),
  });
  container.register(ReviewController, {
    useFactory: instanceCachingFactory(
      (c) =>
        new ReviewController(
          c.resolve(RegisterReviewService),
          c.resolve(UpdateReviewService),
          c.resolve(DeleteReviewService),
        ),
    ),
  });
};

export const resolveControllers = (container: DependencyContainer): Controllers => ({
  bookController: container.resolve(BookController),
  reviewController: container.resolve(ReviewController),
});

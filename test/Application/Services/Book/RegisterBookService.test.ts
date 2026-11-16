import { Author } from "Domain/Models/Book/Author";
import { Book } from "Domain/Models/Book/Book";
import { BookId } from "Domain/Models/Book/BookId";
import { Price } from "Domain/Models/Book/Price";
import { Title } from "Domain/Models/Book/Title";
import { RegisterBookCommand, RegisterBookService } from "Application/Services/Book/RegisterBookService";

import { FakeBookRepository } from "../../TestDoubles/FakeRepositories";
import { FakeTransactionManager } from "../../TestDoubles/FakeTransactionManager";

const command: RegisterBookCommand = {
  bookId: "9784000000000",
  title: "ドメイン駆動設計入門",
  author: "著者",
  price: 3000,
};

const setup = (books: Book[] = []) => {
  const tx = new FakeTransactionManager();
  const bookRepository = new FakeBookRepository(tx, books);
  return { tx, bookRepository, service: new RegisterBookService(bookRepository, tx) };
};

describe("RegisterBookService（UC-BOOK-001 書籍登録）", () => {
  it("未登録の書籍IDなら書籍を保存し、書籍DTOを返す", async () => {
    const { service, bookRepository, tx } = setup();

    const result = await service.execute(command);

    expect(result).toEqual({ ok: true, data: command });
    const saved = bookRepository.books.get(command.bookId);
    expect(saved?.title.value).toBe(command.title);
    expect(saved?.price.value).toBe(command.price);
    expect(tx.events).toEqual(["begin", "commit"]);
  });

  it("未登録の確認と保存を同じトランザクション内で、この順に行う", async () => {
    const { service, bookRepository } = setup();

    await service.execute(command);

    expect(bookRepository.calls).toEqual([
      { method: "findById", inTransaction: true },
      { method: "save", inTransaction: true },
    ]);
  });

  it("書籍IDが登録済みなら保存せず BOOK_ALREADY_EXISTS を返す", async () => {
    const existing = new Book(new BookId(command.bookId), new Title("既存"), new Author("既存著者"), new Price(1));
    const { service, bookRepository, tx } = setup([existing]);

    const result = await service.execute(command);

    expect(result).toEqual({
      ok: false,
      error: { code: "BOOK_ALREADY_EXISTS", message: expect.stringContaining(command.bookId) },
    });
    expect(bookRepository.calls.map((call) => call.method)).toEqual(["findById"]);
    expect(bookRepository.books.get(command.bookId)).toBe(existing);
    // 書き込み前の業務エラーなので、ロールバックではなくコミットで終える
    expect(tx.events).toEqual(["begin", "commit"]);
  });

  it("存在確認の後に同じ書籍IDが登録された（同時登録）なら、ロールバックして BOOK_ALREADY_EXISTS を返す", async () => {
    const concurrent = new Book(new BookId(command.bookId), new Title("先着"), new Author("先着著者"), new Price(1));
    const { service, bookRepository, tx } = setup();
    // findById の直後に別セッションが同じ書籍IDを登録した状況を再現する
    const originalFindById = bookRepository.findById.bind(bookRepository);
    jest.spyOn(bookRepository, "findById").mockImplementation(async (bookId) => {
      const found = await originalFindById(bookId);
      bookRepository.books.set(concurrent.bookId.value, concurrent);
      return found;
    });

    const result = await service.execute(command);

    expect(result).toEqual({
      ok: false,
      error: { code: "BOOK_ALREADY_EXISTS", message: expect.stringContaining(command.bookId) },
    });
    expect(tx.events).toEqual(["begin", "rollback"]);
    expect(bookRepository.books.get(command.bookId)).toBe(concurrent);
  });

  it.each([
    ["書籍IDが13文字でない", { bookId: "978400000000" }],
    ["書籍名が空", { title: "" }],
    ["書籍名が1001文字", { title: "あ".repeat(1001) }],
    ["著者が101文字", { author: "あ".repeat(101) }],
    ["価格が0円", { price: 0 }],
    ["価格が1,000,001円", { price: 1_000_001 }],
    ["価格が整数でない", { price: 100.5 }],
  ])("入力が不正（%s）なら VALIDATION_ERROR を返し、トランザクションを開始しない", async (_, override) => {
    const { service, bookRepository, tx } = setup();

    const result = await service.execute({ ...command, ...override });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("VALIDATION_ERROR");
    expect(bookRepository.calls).toEqual([]);
    expect(tx.events).toEqual([]);
  });

  it.each([
    ["最小値", { title: "あ", author: "あ", price: 1 }],
    ["最大値", { title: "あ".repeat(1000), author: "あ".repeat(100), price: 1_000_000 }],
  ])("境界値（%s）は登録できる", async (_, override) => {
    const { service } = setup();

    const result = await service.execute({ ...command, ...override });

    expect(result).toEqual({ ok: true, data: { ...command, ...override } });
  });

  it.each(["findById", "save"] as const)(
    "リポジトリの %s が失敗したら例外を伝播し、ロールバックする",
    async (method) => {
      const { service, bookRepository, tx } = setup();
      bookRepository.failOn = method;

      await expect(service.execute(command)).rejects.toThrow(`book repository ${method} failed`);
      expect(tx.events).toEqual(["begin", "rollback"]);
    },
  );
});

import { DomainValidationError } from "Domain/Shared/DomainValidationError";
import { Author } from "Domain/Models/Book/Author";
import { Book } from "Domain/Models/Book/Book";
import { BookId } from "Domain/Models/Book/BookId";
import { Price } from "Domain/Models/Book/Price";
import { Title } from "Domain/Models/Book/Title";

const createBook = (
  bookId = "9784000000000",
  title = "ドメイン駆動設計",
  author = "山田太郎",
  price = 3000,
): Book =>
  new Book(new BookId(bookId), new Title(title), new Author(author), new Price(price));

describe("Book", () => {
  describe("生成", () => {
    it("書籍識別子・タイトル・著者・価格を指定して書籍を生成できる", () => {
      const book = createBook();

      expect(book.bookId.equals(new BookId("9784000000000"))).toBe(true);
      expect(book.title.equals(new Title("ドメイン駆動設計"))).toBe(true);
      expect(book.author.equals(new Author("山田太郎"))).toBe(true);
      expect(book.price.equals(new Price(3000))).toBe(true);
    });
  });

  describe("価格変更", () => {
    it("書籍の価格を変更できる", () => {
      const book = createBook();

      book.changePrice(new Price(4500));

      expect(book.price.value).toBe(4500);
    });

    it("価格を変更しても書籍識別子・タイトル・著者は変わらない", () => {
      const book = createBook();

      book.changePrice(new Price(4500));

      expect(book.bookId.value).toBe("9784000000000");
      expect(book.title.value).toBe("ドメイン駆動設計");
      expect(book.author.value).toBe("山田太郎");
    });

    it("価格の制約を満たさない値では価格を変更できない", () => {
      const book = createBook();

      expect(() => book.changePrice(new Price(0))).toThrow(DomainValidationError);
      expect(book.price.value).toBe(3000);
    });
  });

  describe("同一性", () => {
    it("書籍識別子が同じなら他の属性が異なっても同一の書籍とみなす", () => {
      const a = createBook("9784000000000", "タイトルA", "著者A", 1000);
      const b = createBook("9784000000000", "タイトルB", "著者B", 2000);

      expect(a.equals(b)).toBe(true);
    });

    it("書籍識別子が異なれば他の属性が同じでも別の書籍とみなす", () => {
      const a = createBook("9784000000000");
      const b = createBook("9784000000001");

      expect(a.equals(b)).toBe(false);
    });
  });
});

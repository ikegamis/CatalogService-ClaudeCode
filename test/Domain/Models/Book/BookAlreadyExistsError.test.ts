import { BookAlreadyExistsError } from "Domain/Models/Book/BookAlreadyExistsError";
import { BookId } from "Domain/Models/Book/BookId";
import { DomainValidationError } from "Domain/Shared/DomainValidationError";

describe("BookAlreadyExistsError", () => {
  const bookId = new BookId("9784000000000");

  it("重複した書籍IDを保持し、メッセージに含める", () => {
    const error = new BookAlreadyExistsError(bookId);

    expect(error.bookId).toBe(bookId);
    expect(error.message).toContain("9784000000000");
    expect(error.name).toBe("BookAlreadyExistsError");
  });

  it("入力値の制約違反（DomainValidationError）とは区別できる", () => {
    expect(new BookAlreadyExistsError(bookId)).not.toBeInstanceOf(DomainValidationError);
  });
});

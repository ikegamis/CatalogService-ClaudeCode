import { Author } from "./Author";
import { BookId } from "./BookId";
import { Price } from "./Price";
import { Title } from "./Title";

/**
 * 書籍集約の集約ルート。
 * 各属性は値オブジェクトの生成時に検証済みのため、不正な状態の Book は生成できない。
 * 仕様上の振る舞いは価格変更（changePrice）のみであり、他の属性を変更する手段は公開しない。
 */
export class Book {
  private _price: Price;

  constructor(
    private readonly _bookId: BookId,
    private readonly _title: Title,
    private readonly _author: Author,
    price: Price,
  ) {
    this._price = price;
  }

  get bookId(): BookId {
    return this._bookId;
  }

  get title(): Title {
    return this._title;
  }

  get author(): Author {
    return this._author;
  }

  get price(): Price {
    return this._price;
  }

  /** 書籍の価格を変更する。 */
  changePrice(price: Price): void {
    this._price = price;
  }

  /** 書籍の同一性は BookId の値で判定する。 */
  equals(other: Book): boolean {
    return this._bookId.equals(other._bookId);
  }
}

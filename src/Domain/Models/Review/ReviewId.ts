import { ValueObject } from "Domain/Shared/ValueObject";

type ReviewIdValue = string;

/** ULID で用いる Crockford Base32 の文字集合（I, L, O, U を含まない）。 */
const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

/**
 * レビュー識別子（ULID）。
 * 外部ライブラリに依存させないため、ULID の生成は Node.js / Web 標準の crypto.getRandomValues を用いて自前で行う。
 * 先頭1文字が 0〜7 なのは、ULID が 128bit を 26文字（130bit 分）で表すため上位2bitが常に0になることによる。
 */
export class ReviewId extends ValueObject<ReviewIdValue, "ReviewId"> {
  static readonly LENGTH = TIME_LENGTH + RANDOM_LENGTH;
  private static readonly FORMAT = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

  constructor(value: ReviewIdValue) {
    super(value);
  }

  /** 新しい ReviewId を ULID として生成する。 */
  static generate(): ReviewId {
    return new ReviewId(ReviewId.encodeTime(Date.now()) + ReviewId.encodeRandom());
  }

  protected validate(value: ReviewIdValue): void {
    if (value.length !== ReviewId.LENGTH || !ReviewId.FORMAT.test(value)) {
      throw new Error(`ReviewIdは${ReviewId.LENGTH}文字のULIDである必要があります。`);
    }
  }

  private static encodeTime(time: number): string {
    let rest = time;
    let encoded = "";
    for (let i = 0; i < TIME_LENGTH; i++) {
      encoded = CROCKFORD_BASE32.charAt(rest % 32) + encoded;
      rest = Math.floor(rest / 32);
    }
    return encoded;
  }

  private static encodeRandom(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_LENGTH));
    // 各バイトの下位5bitを1文字に対応させる（256 は 32 の倍数なので偏りは生じない）
    return Array.from(bytes, (byte) => CROCKFORD_BASE32.charAt(byte % 32)).join("");
  }
}

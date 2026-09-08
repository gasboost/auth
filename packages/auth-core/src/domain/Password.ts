export class Password {
  constructor(
    public readonly value: string,
    private readonly utilities: GoogleAppsScript.Utilities.Utilities,
    private readonly pepper: string,
  ) {}

  async hash({
    salt = this.utilities.getUuid(),
    iterations = 300,
  }: {
    salt?: string;
    iterations?: number;
  } = {}): Promise<HashedPassword> {
    const passwordBytes = Array.from(
      this.utilities.newBlob(this.value + this.pepper).getBytes(),
    );

    const saltBytes = [
      ...Array.from(this.utilities.newBlob(salt).getBytes()),
      0,
      0,
      0,
      1,
    ];

    let previous = this.utilities.computeHmacSha256Signature(
      saltBytes,
      passwordBytes,
    );

    const result = [...previous];

    for (let i = 1; i < iterations; i++) {
      previous = this.utilities.computeHmacSha256Signature(
        previous,
        passwordBytes,
      );

      for (let j = 0; j < result.length; j++) {
        result[j] = result[j] ^ previous[j];
      }
    }

    const hash = result
      .map((byte) => (byte < 0 ? byte + 256 : byte))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    return new HashedPassword({
      value: hash,
      salt,
      iterations,
    });
  }
}

export class HashedPassword {
  public readonly value: string;
  public readonly salt: string;
  public readonly iterations: number;

  constructor({
    value,
    salt,
    iterations,
  }: {
    value: string;
    salt: string;
    iterations: number;
  }) {
    this.value = value;
    this.salt = salt;
    this.iterations = iterations;
  }

  async verify(password: Password): Promise<boolean> {
    const hashed = await password.hash({
      salt: this.salt,
      iterations: this.iterations,
    });

    if (this.value.length !== hashed.value.length) {
      return false;
    }

    let difference = 0;

    for (let i = 0; i < this.value.length; i++) {
      difference |= this.value.charCodeAt(i) ^ hashed.value.charCodeAt(i);
    }

    return difference === 0;
  }
}

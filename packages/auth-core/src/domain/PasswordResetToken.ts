export class PasswordResetToken {
  constructor(public readonly value: string) {}
  static generate(
    utilities: GoogleAppsScript.Utilities.Utilities,
  ): PasswordResetToken {
    const token = utilities.getUuid();
    return new PasswordResetToken(token);
  }

  public hash(utilities: GoogleAppsScript.Utilities.Utilities): string {
    const tokenHash = utilities
      .computeDigest(Utilities.DigestAlgorithm.SHA_256, this.value)
      .map((b) => ("00" + (b & 0xff).toString(16)).slice(-2))
      .join("");
    return tokenHash;
  }
}

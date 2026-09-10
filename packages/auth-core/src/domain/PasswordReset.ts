import { PasswordResetToken } from "./PasswordResetToken";

export class PasswordReset {
  public readonly id: string;
  public readonly accountId: string;
  public readonly tokenHash: string;
  public readonly expiresAt: Date;
  public readonly enabled: boolean;

  constructor({
    id,
    accountId,
    tokenHash,
    expiresAt,
    enabled,
  }: {
    id: string;
    accountId: string;
    tokenHash: string;
    expiresAt: Date;
    enabled: boolean;
  }) {
    this.id = id;
    this.accountId = accountId;
    this.tokenHash = tokenHash;
    this.expiresAt = expiresAt;
    this.enabled = enabled;
  }

  public static create({
    accountId,
    utilities,
    expiresAt,
  }: {
    accountId: string;
    utilities: GoogleAppsScript.Utilities.Utilities;
    expiresAt: Date;
  }): {
    reset: PasswordReset;
    token: string;
  } {
    const token = PasswordResetToken.generate(utilities);

    return {
      token: token.value,
      reset: new PasswordReset({
        id: utilities.getUuid(),
        accountId,
        tokenHash: token.hash(utilities),
        expiresAt,
        enabled: true,
      }),
    };
  }

  public verify(
    token: string,
    utilities: GoogleAppsScript.Utilities.Utilities,
  ): boolean {
    const tokenHash = new PasswordResetToken(token).hash(utilities);
    return tokenHash === this.tokenHash;
  }

  public isExpired(now: Date): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  public disable(): PasswordReset {
    return new PasswordReset({
      id: this.id,
      accountId: this.accountId,
      tokenHash: this.tokenHash,
      expiresAt: this.expiresAt,
      enabled: false,
    });
  }
}

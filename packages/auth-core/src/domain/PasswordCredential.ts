import { EmailPasswordIdentity } from "../identity/EmailPasswordIdentity";
import { Account } from "./Account";
import { InvalidPasswordResetError } from "./Errors";
import type { HashedPassword } from "./Password";
import { PasswordReset } from "./PasswordReset";

export class PasswordCredential {
  public readonly account: Account;
  public readonly reset: PasswordReset | null;

  constructor({
    account,
    reset,
  }: {
    account: Account;
    reset: PasswordReset | null;
  }) {
    this.account = account;
    this.reset = reset;
  }

  public static generate({
    account,
    utilities,
    expiresAt,
  }: {
    account: Account;
    utilities: GoogleAppsScript.Utilities.Utilities;
    expiresAt: Date;
  }): {
    credential: PasswordCredential;
    token: string;
  } {
    if (!(account.identity instanceof EmailPasswordIdentity)) {
      throw new Error("Invalid account identity");
    }

    const { reset, token } = PasswordReset.create({
      accountId: account.id,
      utilities,
      expiresAt,
    });

    return {
      credential: new PasswordCredential({
        account,
        reset,
      }),
      token,
    };
  }

  public resetPassword({
    token,
    newPassword,
    utilities,
    now,
  }: {
    token: string;
    newPassword: HashedPassword;
    utilities: GoogleAppsScript.Utilities.Utilities;
    now: Date;
  }): PasswordCredential {
    if (this.reset === null) {
      throw new InvalidPasswordResetError();
    }

    if (this.reset.accountId !== this.account.id) {
      throw new InvalidPasswordResetError();
    }

    if (this.reset.enabled === false) {
      throw new InvalidPasswordResetError();
    }

    if (this.reset.isExpired(now)) {
      throw new InvalidPasswordResetError();
    }

    if (this.reset.verify(token, utilities) === false) {
      throw new InvalidPasswordResetError();
    }

    if (!(this.account.identity instanceof EmailPasswordIdentity)) {
      throw new Error("Invalid account identity");
    }

    return new PasswordCredential({
      account: new Account({
        id: this.account.id,
        userId: this.account.userId,
        identity: this.account.identity.changePassword(newPassword),
      }),
      reset: this.reset.disable(),
    });
  }
}

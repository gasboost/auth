import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, it } from "vitest";

import { Account } from "../../src/domain/Account";
import { InvalidPasswordResetError } from "../../src/domain/Errors";
import { HashedPassword } from "../../src/domain/Password";
import { PasswordCredential } from "../../src/domain/PasswordCredential";
import { PasswordReset } from "../../src/domain/PasswordReset";
import { AppsScriptIdentity } from "../../src/identity/AppsScriptIdentity";
import { EmailPasswordIdentity } from "../../src/identity/EmailPasswordIdentity";

function createAccount() {
  return new Account({
    id: "account-1",
    userId: "user-1",
    identity: new EmailPasswordIdentity({
      accountId: "user@example.com",
      password: new HashedPassword({
        value: "old-password-hash",
      }),
    }),
  });
}

describe("PasswordCredential", () => {
  it("EmailPassword AccountからPasswordCredentialを生成できる", () => {
    const utilities = new NodeUtilities();
    const account = createAccount();
    const expiresAt = new Date("2026-09-10T10:00:00+09:00");

    const { credential, token } = PasswordCredential.generate({
      account,
      utilities,
      expiresAt,
    });

    expect(credential.account).toBe(account);
    expect(credential.reset).not.toBeNull();

    expect(credential.reset?.accountId).toBe(account.id);
    expect(credential.reset?.enabled).toBe(true);
    expect(credential.reset?.expiresAt).toEqual(expiresAt);

    expect(token).toBeTruthy();
    expect(credential.reset?.tokenHash).not.toBe(token);
    expect(credential.reset?.verify(token, utilities)).toBe(true);
  });

  it("EmailPasswordIdentity以外のAccountからは生成できない", () => {
    const utilities = new NodeUtilities();

    const account = new Account({
      id: "account-1",
      userId: "user-1",
      identity: new AppsScriptIdentity({
        googleAccountAddress: "user@example.com",
      }),
    });

    expect(() =>
      PasswordCredential.generate({
        account,
        utilities,
        expiresAt: new Date("2026-09-10T10:00:00+09:00"),
      }),
    ).toThrow("Invalid account identity");
  });

  it("有効なtokenでpasswordを変更してresetを無効化する", () => {
    const utilities = new NodeUtilities();
    const account = createAccount();

    const { credential, token } = PasswordCredential.generate({
      account,
      utilities,
      expiresAt: new Date("2026-09-10T10:00:00+09:00"),
    });

    const newPassword = new HashedPassword({
      value: "new-password-hash",
    });

    const updated = credential.resetPassword({
      token,
      newPassword,
      utilities,
      now: new Date("2026-09-10T09:00:00+09:00"),
    });

    expect(updated).not.toBe(credential);
    expect(updated.account).not.toBe(credential.account);

    expect(updated.account.id).toBe(account.id);
    expect(updated.account.userId).toBe(account.userId);

    expect(updated.account.identity).toBeInstanceOf(EmailPasswordIdentity);

    if (!(updated.account.identity instanceof EmailPasswordIdentity)) {
      throw new Error("Expected EmailPasswordIdentity");
    }

    expect(updated.account.identity.password).toBe(newPassword);
    expect(updated.reset?.enabled).toBe(false);

    expect(credential.reset?.enabled).toBe(true);
  });

  it("resetが存在しない場合はInvalidPasswordResetErrorになる", () => {
    const utilities = new NodeUtilities();

    const credential = new PasswordCredential({
      account: createAccount(),
      reset: null,
    });

    expect(() =>
      credential.resetPassword({
        token: "token",
        newPassword: new HashedPassword({
          value: "new-password-hash",
        }),
        utilities,
        now: new Date(),
      }),
    ).toThrow(InvalidPasswordResetError);
  });

  it("AccountとPasswordResetのaccountIdが一致しない場合はInvalidPasswordResetErrorになる", () => {
    const utilities = new NodeUtilities();
    const account = createAccount();

    const { reset, token } = PasswordReset.create({
      accountId: "other-account",
      utilities,
      expiresAt: new Date("2026-09-10T10:00:00+09:00"),
    });

    const credential = new PasswordCredential({
      account,
      reset,
    });

    expect(() =>
      credential.resetPassword({
        token,
        newPassword: new HashedPassword({
          value: "new-password-hash",
        }),
        utilities,
        now: new Date("2026-09-10T09:00:00+09:00"),
      }),
    ).toThrow(InvalidPasswordResetError);
  });

  it("無効化済みresetはInvalidPasswordResetErrorになる", () => {
    const utilities = new NodeUtilities();
    const account = createAccount();

    const { reset, token } = PasswordReset.create({
      accountId: account.id,
      utilities,
      expiresAt: new Date("2026-09-10T10:00:00+09:00"),
    });

    const credential = new PasswordCredential({
      account,
      reset: reset.disable(),
    });

    expect(() =>
      credential.resetPassword({
        token,
        newPassword: new HashedPassword({
          value: "new-password-hash",
        }),
        utilities,
        now: new Date("2026-09-10T09:00:00+09:00"),
      }),
    ).toThrow(InvalidPasswordResetError);
  });

  it("期限切れresetはInvalidPasswordResetErrorになる", () => {
    const utilities = new NodeUtilities();
    const account = createAccount();

    const { reset, token } = PasswordReset.create({
      accountId: account.id,
      utilities,
      expiresAt: new Date("2026-09-10T09:00:00+09:00"),
    });

    const credential = new PasswordCredential({
      account,
      reset,
    });

    expect(() =>
      credential.resetPassword({
        token,
        newPassword: new HashedPassword({
          value: "new-password-hash",
        }),
        utilities,
        now: new Date("2026-09-10T09:00:00+09:00"),
      }),
    ).toThrow(InvalidPasswordResetError);
  });

  it("不正なtokenはInvalidPasswordResetErrorになる", () => {
    const utilities = new NodeUtilities();
    const account = createAccount();

    const { credential } = PasswordCredential.generate({
      account,
      utilities,
      expiresAt: new Date("2026-09-10T10:00:00+09:00"),
    });

    expect(() =>
      credential.resetPassword({
        token: "invalid-token",
        newPassword: new HashedPassword({
          value: "new-password-hash",
        }),
        utilities,
        now: new Date("2026-09-10T09:00:00+09:00"),
      }),
    ).toThrow(InvalidPasswordResetError);
  });

  it("reset資格エラーは同じ外部メッセージになる", () => {
    const error = new InvalidPasswordResetError();

    expect(error.message).toBe("Invalid password reset token");
  });
});

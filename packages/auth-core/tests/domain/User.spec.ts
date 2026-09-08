import { describe, expect, it } from "vitest";
import { authPattern } from "../../src/AuthPattern";
import { Account } from "../../src/domain/Account";
import { User } from "../../src/domain/User";
import type { ProviderIdentity } from "../../src/identity/ProviderIdentity";

describe("User", () => {
  it("指定した認証方式のAccountを取得する", () => {
    const appsScriptAccount = new Account({
      id: "account-apps-script",
      userId: "user-1",
      identity: {
        providerName: authPattern.appsScript,
        accountId: "user@example.com",
      } satisfies ProviderIdentity,
    });

    const emailPasswordAccount = new Account({
      id: "account-email-password",
      userId: "user-1",
      identity: {
        providerName: authPattern.emailPassword,
        accountId: "login@example.com",
      } satisfies ProviderIdentity,
    });

    const user = new User({
      id: "user-1",
      name: "Taro",
      accounts: [appsScriptAccount, emailPasswordAccount],
    });

    expect(user.account(authPattern.appsScript)).toBe(appsScriptAccount);

    expect(user.account(authPattern.emailPassword)).toBe(emailPasswordAccount);
  });

  it("指定した認証方式のAccountが存在しない場合はnullを返す", () => {
    const user = new User({
      id: "user-1",
      name: "Taro",
      accounts: [],
    });

    expect(user.account(authPattern.appsScript)).toBeNull();
  });
});

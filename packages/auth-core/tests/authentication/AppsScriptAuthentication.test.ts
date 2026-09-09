import {
  InMemoryContext,
  InMemorySession,
  OAuthScope,
  SecurityPolicy,
} from "@gasboost/fake-core";
import { describe, expect, it, vi } from "vitest";

import { authPattern } from "../../src/AuthPattern";
import { AppsScriptAuthentication } from "../../src/authentication/AppsScriptAuthentication";
import { Account } from "../../src/domain/Account";
import { HashedPassword } from "../../src/domain/Password";
import { User } from "../../src/domain/User";
import { AppsScriptIdentity } from "../../src/identity/AppsScriptIdentity";
import { EmailPasswordIdentity } from "../../src/identity/EmailPasswordIdentity";
import type { AppsScriptAuthRepository } from "../../src/storage/AppsScriptAuthRepository";

function createSession(email: string) {
  const context = new InMemoryContext(
    "owner@example.com",
    email,
    {
      type: "WEB_APP",
      executeAs: "USER",
    },
    new SecurityPolicy([OAuthScope.USERINFO_EMAIL]),
    "ja",
    "Asia/Tokyo",
  );

  return new InMemorySession(context);
}

function createRepository({
  account = null,
  user = null,
}: {
  account?: Account | null;
  user?: User | null;
} = {}) {
  return {
    account: {
      findByIdentity: vi.fn().mockResolvedValue(account),
    },
    user: {
      find: vi.fn().mockResolvedValue(user),
      create: vi.fn(),
    },
  } satisfies AppsScriptAuthRepository;
}

describe("AppsScriptAuthentication", () => {
  it("ActiveUserに対応するUserを返す", async () => {
    const account = new Account({
      id: "account-1",
      userId: "user-1",
      identity: new AppsScriptIdentity({
        googleAccountAddress: "user@example.com",
      }),
    });

    const user = new User({
      id: "user-1",
      name: "Taro",
      accounts: [account],
    });

    const repository = createRepository({
      account,
      user,
    });

    const authentication = new AppsScriptAuthentication(
      repository,
      createSession("user@example.com"),
    );

    const result = await authentication.verify({});

    expect(result).toBe(user);
    expect(repository.account.findByIdentity).toHaveBeenCalledWith(
      authPattern.appsScript,
      "user@example.com",
    );
    expect(repository.user.find).toHaveBeenCalledWith("user-1");
  });

  it("Accountが存在しない場合は失敗する", async () => {
    const repository = createRepository();

    const authentication = new AppsScriptAuthentication(
      repository,
      createSession("user@example.com"),
    );

    await expect(authentication.verify({})).rejects.toThrow(
      "Account not found",
    );

    expect(repository.account.findByIdentity).toHaveBeenCalledWith(
      authPattern.appsScript,
      "user@example.com",
    );
    expect(repository.user.find).not.toHaveBeenCalled();
  });

  it("AppsScriptIdentityではない場合は失敗する", async () => {
    const account = new Account({
      id: "account-1",
      userId: "user-1",
      identity: new EmailPasswordIdentity({
        accountId: "user@example.com",
        password: new HashedPassword({
          value: "hash",
        }),
      }),
    });

    const repository = createRepository({
      account,
    });

    const authentication = new AppsScriptAuthentication(
      repository,
      createSession("user@example.com"),
    );

    await expect(authentication.verify({})).rejects.toThrow("Invalid identity");

    expect(repository.user.find).not.toHaveBeenCalled();
  });

  it("Userが存在しない場合は失敗する", async () => {
    const account = new Account({
      id: "account-1",
      userId: "user-1",
      identity: new AppsScriptIdentity({
        googleAccountAddress: "user@example.com",
      }),
    });

    const repository = createRepository({
      account,
      user: null,
    });

    const authentication = new AppsScriptAuthentication(
      repository,
      createSession("user@example.com"),
    );

    await expect(authentication.verify({})).rejects.toThrow("User not found");

    expect(repository.user.find).toHaveBeenCalledWith("user-1");
  });

  it("ActiveUserのemailが取得できない場合は失敗する", async () => {
    const repository = createRepository();

    const authentication = new AppsScriptAuthentication(
      repository,
      createSession(""),
    );

    await expect(authentication.verify({})).rejects.toThrow(
      "No active user found",
    );

    expect(repository.account.findByIdentity).not.toHaveBeenCalled();
  });
});

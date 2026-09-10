import {
  InMemoryContext,
  InMemorySession,
  OAuthScope,
  SecurityPolicy,
} from "@gasboost/fake-core";
import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, it, vi } from "vitest";

import { authPattern } from "../../src/AuthPattern";
import type { Account } from "../../src/domain/Account";
import type { User } from "../../src/domain/User";
import { AppsScriptIdentity } from "../../src/identity/AppsScriptIdentity";
import { AppsScriptRegistration } from "../../src/registration/AppsScriptRegistration";
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
}: {
  account?: Account | null;
} = {}) {
  return {
    account: {
      findByIdentity: vi.fn().mockResolvedValue(account),
    },
    user: {
      find: vi.fn(),
      create: vi.fn(async (user: User) => user),
    },
    passwordCredential: {
      findByResetTokenHash: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    },
  } satisfies AppsScriptAuthRepository;
}

describe("AppsScriptRegistration", () => {
  it("ActiveUserからUserとAccountを生成して保存する", async () => {
    const repository = createRepository();
    const utilities = new NodeUtilities();

    const registration = new AppsScriptRegistration(
      utilities,
      createSession("user@example.com"),
      repository,
    );

    const user = await registration.register({
      name: "Taro",
    });

    expect(user.name).toBe("Taro");
    expect(user.accounts).toHaveLength(1);

    const account = user.accounts[0];

    expect(account.userId).toBe(user.id);
    expect(account.identity).toBeInstanceOf(AppsScriptIdentity);
    expect(account.identity.accountId).toBe("user@example.com");

    expect(repository.account.findByIdentity).toHaveBeenCalledWith(
      authPattern.appsScript,
      "user@example.com",
    );

    expect(repository.user.create).toHaveBeenCalledWith(user);
  });

  it("同じApps Script identityが既に存在する場合は拒否する", async () => {
    const existingAccount = {
      id: "account-1",
      userId: "user-1",
      identity: new AppsScriptIdentity({
        googleAccountAddress: "user@example.com",
      }),
    } as Account;

    const repository = createRepository({
      account: existingAccount,
    });

    const registration = new AppsScriptRegistration(
      new NodeUtilities(),
      createSession("user@example.com"),
      repository,
    );

    await expect(
      registration.register({
        name: "Taro",
      }),
    ).rejects.toThrow("Account already registered");

    expect(repository.account.findByIdentity).toHaveBeenCalledWith(
      authPattern.appsScript,
      "user@example.com",
    );

    expect(repository.user.create).not.toHaveBeenCalled();
  });

  it("identityの重複確認はappsScript providerに限定する", async () => {
    const repository = createRepository();

    const registration = new AppsScriptRegistration(
      new NodeUtilities(),
      createSession("user@example.com"),
      repository,
    );

    await registration.register({
      name: "Taro",
    });

    expect(repository.account.findByIdentity).toHaveBeenCalledWith(
      authPattern.appsScript,
      "user@example.com",
    );
  });

  it("ActiveUserのemailが取得できない場合はRepositoryを触らず失敗する", async () => {
    const repository = createRepository();

    const registration = new AppsScriptRegistration(
      new NodeUtilities(),
      createSession(""),
      repository,
    );

    await expect(
      registration.register({
        name: "Taro",
      }),
    ).rejects.toThrow("No active user found");

    expect(repository.account.findByIdentity).not.toHaveBeenCalled();

    expect(repository.user.create).not.toHaveBeenCalled();
  });
});

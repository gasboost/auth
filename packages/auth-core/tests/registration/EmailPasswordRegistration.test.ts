import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, it, vi } from "vitest";

import { EmailPasswordAuthConfig } from "../../src/authentication/EmailPasswordAuthentication";
import { authPattern } from "../../src/AuthPattern";
import { Account } from "../../src/domain/Account";
import { Password } from "../../src/domain/Password";
import { User } from "../../src/domain/User";
import { EmailPasswordIdentity } from "../../src/identity/EmailPasswordIdentity";
import { EmailPasswordRegistration } from "../../src/registration/EmailPasswordRegistration";
import type { AppsScriptAuthRepository } from "../../src/storage/AppsScriptAuthRepository";

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
  } satisfies AppsScriptAuthRepository;
}

function createConfig(): EmailPasswordAuthConfig {
  return new EmailPasswordAuthConfig({
    enabled: true,
    pepper: "pepper",
    iterations: 300,
  });
}

describe("EmailPasswordRegistration", () => {
  it("emailとpasswordからUserとAccountを生成して保存する", async () => {
    const repository = createRepository();
    const utilities = new NodeUtilities();

    const registration = new EmailPasswordRegistration(
      repository,
      utilities,
      createConfig(),
    );

    const user = await registration.register({
      name: "Taro",
      email: "user@example.com",
      password: "password",
    });

    expect(user.name).toBe("Taro");
    expect(user.accounts).toHaveLength(1);

    const account = user.accounts[0];

    expect(account.userId).toBe(user.id);
    expect(account.identity).toBeInstanceOf(EmailPasswordIdentity);
    expect(account.identity.accountId).toBe("user@example.com");

    expect(repository.account.findByIdentity).toHaveBeenCalledWith(
      authPattern.emailPassword,
      "user@example.com",
    );

    expect(repository.user.create).toHaveBeenCalledWith(user);
  });

  it("保存されたpasswordで認証できる", async () => {
    const repository = createRepository();
    const utilities = new NodeUtilities();
    const config = createConfig();

    const registration = new EmailPasswordRegistration(
      repository,
      utilities,
      config,
    );

    const user = await registration.register({
      name: "Taro",
      email: "user@example.com",
      password: "password",
    });

    const account = user.accounts[0];
    const identity = account.identity as EmailPasswordIdentity;

    const password = new Password(
      "password",
      utilities,
      config.pepper,
      config.iterations,
    );

    await expect(identity.verify(password, account.id)).resolves.toBe(true);
  });

  it("同じemailPassword identityが既に存在する場合は拒否する", async () => {
    const existingAccount = new Account({
      id: "account-1",
      userId: "user-1",
      identity: {
        providerName: authPattern.emailPassword,
        accountId: "user@example.com",
      } as EmailPasswordIdentity,
    });

    const repository = createRepository({
      account: existingAccount,
    });

    const registration = new EmailPasswordRegistration(
      repository,
      new NodeUtilities(),
      createConfig(),
    );

    await expect(
      registration.register({
        name: "Taro",
        email: "user@example.com",
        password: "password",
      }),
    ).rejects.toThrow("Account already registered");

    expect(repository.account.findByIdentity).toHaveBeenCalledWith(
      authPattern.emailPassword,
      "user@example.com",
    );

    expect(repository.user.create).not.toHaveBeenCalled();
  });

  it("identityの重複確認はemailPassword providerに限定する", async () => {
    const repository = createRepository();

    const registration = new EmailPasswordRegistration(
      repository,
      new NodeUtilities(),
      createConfig(),
    );

    await registration.register({
      name: "Taro",
      email: "user@example.com",
      password: "password",
    });

    expect(repository.account.findByIdentity).toHaveBeenCalledWith(
      authPattern.emailPassword,
      "user@example.com",
    );
  });
});

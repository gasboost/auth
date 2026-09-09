import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, it, vi } from "vitest";

import { authPattern } from "../../src/AuthPattern";
import {
  EmailPasswordAuthConfig,
  EmailPasswordAuthentication,
} from "../../src/authentication/EmailPasswordAuthentication";
import { Account } from "../../src/domain/Account";
import { Password } from "../../src/domain/Password";
import { User } from "../../src/domain/User";
import { AppsScriptIdentity } from "../../src/identity/AppsScriptIdentity";
import { EmailPasswordIdentity } from "../../src/identity/EmailPasswordIdentity";
import type { AppsScriptAuthRepository } from "../../src/storage/AppsScriptAuthRepository";

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

function createConfig({
  pepper = "pepper",
  iterations = 3,
}: {
  pepper?: string;
  iterations?: number;
} = {}) {
  return new EmailPasswordAuthConfig({
    enabled: true,
    pepper,
    iterations,
  });
}

describe("EmailPasswordAuthentication", () => {
  it("emailとpasswordが正しい場合はUserを返す", async () => {
    const utilities = new NodeUtilities();
    const config = createConfig();

    const hashedPassword = await new Password(
      "password",
      utilities,
      config.pepper,
      config.iterations,
    ).hash("account-1");

    const account = new Account({
      id: "account-1",
      userId: "user-1",
      identity: new EmailPasswordIdentity({
        accountId: "user@example.com",
        password: hashedPassword,
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

    const authentication = new EmailPasswordAuthentication(
      repository,
      utilities,
      config,
    );

    const result = await authentication.verify({
      email: "user@example.com",
      password: "password",
    });

    expect(result).toBe(user);

    expect(repository.account.findByIdentity).toHaveBeenCalledWith(
      authPattern.emailPassword,
      "user@example.com",
    );

    expect(repository.user.find).toHaveBeenCalledWith("user-1");
  });

  it("Accountが存在しない場合は失敗する", async () => {
    const repository = createRepository();

    const authentication = new EmailPasswordAuthentication(
      repository,
      new NodeUtilities(),
      createConfig(),
    );

    await expect(
      authentication.verify({
        email: "user@example.com",
        password: "password",
      }),
    ).rejects.toThrow("Account not found");

    expect(repository.user.find).not.toHaveBeenCalled();
  });

  it("EmailPasswordIdentityではない場合は失敗する", async () => {
    const account = new Account({
      id: "account-1",
      userId: "user-1",
      identity: new AppsScriptIdentity({
        googleAccountAddress: "user@example.com",
      }),
    });

    const repository = createRepository({
      account,
    });

    const authentication = new EmailPasswordAuthentication(
      repository,
      new NodeUtilities(),
      createConfig(),
    );

    await expect(
      authentication.verify({
        email: "user@example.com",
        password: "password",
      }),
    ).rejects.toThrow("Invalid identity");

    expect(repository.user.find).not.toHaveBeenCalled();
  });

  it("passwordが間違っている場合は失敗する", async () => {
    const utilities = new NodeUtilities();
    const config = createConfig();

    const hashedPassword = await new Password(
      "correct-password",
      utilities,
      config.pepper,
      config.iterations,
    ).hash("account-1");

    const account = new Account({
      id: "account-1",
      userId: "user-1",
      identity: new EmailPasswordIdentity({
        accountId: "user@example.com",
        password: hashedPassword,
      }),
    });

    const repository = createRepository({
      account,
    });

    const authentication = new EmailPasswordAuthentication(
      repository,
      utilities,
      config,
    );

    await expect(
      authentication.verify({
        email: "user@example.com",
        password: "wrong-password",
      }),
    ).rejects.toThrow("Invalid password");

    expect(repository.user.find).not.toHaveBeenCalled();
  });

  it("pepperが異なる場合は失敗する", async () => {
    const utilities = new NodeUtilities();

    const hashedPassword = await new Password(
      "password",
      utilities,
      "correct-pepper",
      3,
    ).hash("account-1");

    const account = new Account({
      id: "account-1",
      userId: "user-1",
      identity: new EmailPasswordIdentity({
        accountId: "user@example.com",
        password: hashedPassword,
      }),
    });

    const repository = createRepository({
      account,
    });

    const authentication = new EmailPasswordAuthentication(
      repository,
      utilities,
      createConfig({
        pepper: "wrong-pepper",
      }),
    );

    await expect(
      authentication.verify({
        email: "user@example.com",
        password: "password",
      }),
    ).rejects.toThrow("Invalid password");

    expect(repository.user.find).not.toHaveBeenCalled();
  });

  it("Userが存在しない場合は失敗する", async () => {
    const utilities = new NodeUtilities();
    const config = createConfig();

    const hashedPassword = await new Password(
      "password",
      utilities,
      config.pepper,
      config.iterations,
    ).hash("account-1");

    const account = new Account({
      id: "account-1",
      userId: "user-1",
      identity: new EmailPasswordIdentity({
        accountId: "user@example.com",
        password: hashedPassword,
      }),
    });

    const repository = createRepository({
      account,
      user: null,
    });

    const authentication = new EmailPasswordAuthentication(
      repository,
      utilities,
      config,
    );

    await expect(
      authentication.verify({
        email: "user@example.com",
        password: "password",
      }),
    ).rejects.toThrow("User not found");

    expect(repository.user.find).toHaveBeenCalledWith("user-1");
  });

  it("Account.idをsaltとしてpasswordを検証する", async () => {
    const utilities = new NodeUtilities();
    const config = createConfig();

    const hashedPassword = await new Password(
      "password",
      utilities,
      config.pepper,
      config.iterations,
    ).hash("account-1");

    const account = new Account({
      id: "account-1",
      userId: "user-1",
      identity: new EmailPasswordIdentity({
        accountId: "user@example.com",
        password: hashedPassword,
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

    const authentication = new EmailPasswordAuthentication(
      repository,
      utilities,
      config,
    );

    await expect(
      authentication.verify({
        email: "user@example.com",
        password: "password",
      }),
    ).resolves.toBe(user);
  });

  it("providerAccountIdをsaltにしたhashでは認証できない", async () => {
    const utilities = new NodeUtilities();
    const config = createConfig();

    const hashedPassword = await new Password(
      "password",
      utilities,
      config.pepper,
      config.iterations,
    ).hash("user@example.com");

    const account = new Account({
      id: "account-1",
      userId: "user-1",
      identity: new EmailPasswordIdentity({
        accountId: "user@example.com",
        password: hashedPassword,
      }),
    });

    const repository = createRepository({
      account,
    });

    const authentication = new EmailPasswordAuthentication(
      repository,
      utilities,
      config,
    );

    await expect(
      authentication.verify({
        email: "user@example.com",
        password: "password",
      }),
    ).rejects.toThrow("Invalid password");

    expect(repository.user.find).not.toHaveBeenCalled();
  });

  it("configのiterationsと異なる回数で生成されたhashは認証できない", async () => {
    const utilities = new NodeUtilities();

    const hashedPassword = await new Password(
      "password",
      utilities,
      "pepper",
      2,
    ).hash("account-1");

    const account = new Account({
      id: "account-1",
      userId: "user-1",
      identity: new EmailPasswordIdentity({
        accountId: "user@example.com",
        password: hashedPassword,
      }),
    });

    const repository = createRepository({
      account,
    });

    const authentication = new EmailPasswordAuthentication(
      repository,
      utilities,
      createConfig({
        iterations: 3,
      }),
    );

    await expect(
      authentication.verify({
        email: "user@example.com",
        password: "password",
      }),
    ).rejects.toThrow("Invalid password");

    expect(repository.user.find).not.toHaveBeenCalled();
  });
});

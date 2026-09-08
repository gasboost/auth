import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, it, vi } from "vitest";

import { authPattern } from "../../src/AuthPattern";
import { EmailPasswordAuthentication } from "../../src/authentication/EmailPasswordAuthentication";
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

describe("EmailPasswordAuthentication", () => {
  it("emailとpasswordが正しい場合はUserを返す", async () => {
    const utilities = new NodeUtilities();
    const pepper = "pepper";

    const hashedPassword = await new Password(
      "password",
      utilities,
      pepper,
    ).hash({
      salt: "salt",
      iterations: 3,
    });

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
      pepper,
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
      "pepper",
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
      "pepper",
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
    const pepper = "pepper";

    const hashedPassword = await new Password(
      "correct-password",
      utilities,
      pepper,
    ).hash({
      salt: "salt",
      iterations: 3,
    });

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
      pepper,
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
    ).hash({
      salt: "salt",
      iterations: 3,
    });

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
      "wrong-pepper",
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
    const pepper = "pepper";

    const hashedPassword = await new Password(
      "password",
      utilities,
      pepper,
    ).hash({
      salt: "salt",
      iterations: 3,
    });

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
      pepper,
    );

    await expect(
      authentication.verify({
        email: "user@example.com",
        password: "password",
      }),
    ).rejects.toThrow("User not found");

    expect(repository.user.find).toHaveBeenCalledWith("user-1");
  });
});

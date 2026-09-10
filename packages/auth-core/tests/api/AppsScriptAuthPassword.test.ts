import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, it, vi } from "vitest";

import {
  AppsScriptAuthPassword,
  type PasswordResetDelivery,
} from "../../src/api/AppsScriptAuthPassword";
import { EmailPasswordAuthConfig } from "../../src/authentication/EmailPasswordAuthentication";
import { authPattern } from "../../src/AuthPattern";
import { Account } from "../../src/domain/Account";
import { Password } from "../../src/domain/Password";
import { PasswordCredential } from "../../src/domain/PasswordCredential";
import { PasswordResetToken } from "../../src/domain/PasswordResetToken";
import { EmailPasswordIdentity } from "../../src/identity/EmailPasswordIdentity";
import type { AppsScriptAuthRepository } from "../../src/storage/AppsScriptAuthRepository";

function createRepository(): AppsScriptAuthRepository {
  return {
    account: {
      findByIdentity: vi.fn(),
    },
    user: {
      find: vi.fn(),
      create: vi.fn(),
    },
    passwordCredential: {
      findByResetTokenHash: vi.fn(),
      save: vi.fn(),
    },
  };
}

function createDelivery(): PasswordResetDelivery {
  return {
    send: vi.fn(),
  };
}

async function createAccount(utilities: NodeUtilities): Promise<Account> {
  const password = new Password("old-password", utilities, "pepper", 300);

  return new Account({
    id: "account-1",
    userId: "user-1",
    identity: new EmailPasswordIdentity({
      accountId: "user@example.com",
      password: await password.hash("account-1"),
    }),
  });
}

function createPassword({
  repository,
  utilities,
  delivery,
  expiresIn = 3600,
}: {
  repository: AppsScriptAuthRepository;
  utilities: NodeUtilities;
  delivery: PasswordResetDelivery;
  expiresIn?: number;
}) {
  return new AppsScriptAuthPassword({
    repository,
    utilities,
    emailPassword: new EmailPasswordAuthConfig({
      enabled: true,
      pepper: "pepper",
      iterations: 300,
      passwordReset: {
        delivery,
        expiresIn,
      },
    }),
  });
}

describe("AppsScriptAuthPassword", () => {
  it("forgotでAccountをEmailPassword identityから検索する", async () => {
    const repository = createRepository();
    const utilities = new NodeUtilities();
    const delivery = createDelivery();

    vi.mocked(repository.account.findByIdentity).mockResolvedValue(null);

    const password = createPassword({
      repository,
      utilities,
      delivery,
    });

    await password.forgot({
      email: "user@example.com",
    });

    expect(repository.account.findByIdentity).toHaveBeenCalledWith(
      authPattern.emailPassword,
      "user@example.com",
    );
  });

  it("存在するemailではPasswordCredentialを保存してplain tokenをdeliveryへ渡す", async () => {
    const repository = createRepository();
    const utilities = new NodeUtilities();
    const delivery = createDelivery();
    const account = await createAccount(utilities);

    vi.mocked(repository.account.findByIdentity).mockResolvedValue(account);

    const password = createPassword({
      repository,
      utilities,
      delivery,
    });

    await password.forgot({
      email: "user@example.com",
    });

    expect(repository.passwordCredential.save).toHaveBeenCalledTimes(1);

    const credential = vi.mocked(repository.passwordCredential.save).mock
      .calls[0][0];

    expect(credential.account).toBe(account);
    expect(credential.reset).not.toBeNull();
    expect(credential.reset?.enabled).toBe(true);

    expect(delivery.send).toHaveBeenCalledTimes(1);

    const deliveryInput = vi.mocked(delivery.send).mock.calls[0][0];

    expect(deliveryInput.email).toBe("user@example.com");
    expect(deliveryInput.token).toBeTruthy();

    expect(credential.reset?.tokenHash).not.toBe(deliveryInput.token);

    expect(credential.reset?.verify(deliveryInput.token, utilities)).toBe(true);
  });

  it("存在しないemailでも成功し何も保存・送信しない", async () => {
    const repository = createRepository();
    const utilities = new NodeUtilities();
    const delivery = createDelivery();

    vi.mocked(repository.account.findByIdentity).mockResolvedValue(null);

    const password = createPassword({
      repository,
      utilities,
      delivery,
    });

    await expect(
      password.forgot({
        email: "missing@example.com",
      }),
    ).resolves.toBeUndefined();

    expect(repository.passwordCredential.save).not.toHaveBeenCalled();
    expect(delivery.send).not.toHaveBeenCalled();
  });

  it("forgotでRepository保存に失敗した場合はdeliveryを実行しない", async () => {
    const repository = createRepository();
    const utilities = new NodeUtilities();
    const delivery = createDelivery();
    const account = await createAccount(utilities);

    vi.mocked(repository.account.findByIdentity).mockResolvedValue(account);

    vi.mocked(repository.passwordCredential.save).mockRejectedValue(
      new Error("Repository failure"),
    );

    const password = createPassword({
      repository,
      utilities,
      delivery,
    });

    await expect(
      password.forgot({
        email: "user@example.com",
      }),
    ).rejects.toThrow("Repository failure");

    expect(delivery.send).not.toHaveBeenCalled();
  });

  it("forgotでdeliveryに失敗した場合はエラーを伝播する", async () => {
    const repository = createRepository();
    const utilities = new NodeUtilities();
    const delivery = createDelivery();
    const account = await createAccount(utilities);

    vi.mocked(repository.account.findByIdentity).mockResolvedValue(account);

    vi.mocked(delivery.send).mockRejectedValue(new Error("Delivery failure"));

    const password = createPassword({
      repository,
      utilities,
      delivery,
    });

    await expect(
      password.forgot({
        email: "user@example.com",
      }),
    ).rejects.toThrow("Delivery failure");

    expect(repository.passwordCredential.save).toHaveBeenCalledTimes(1);
  });

  it("reset token hashからPasswordCredentialを検索する", async () => {
    const repository = createRepository();
    const utilities = new NodeUtilities();
    const delivery = createDelivery();

    vi.mocked(
      repository.passwordCredential.findByResetTokenHash,
    ).mockResolvedValue(null);

    const password = createPassword({
      repository,
      utilities,
      delivery,
    });

    const token = "reset-token";

    await expect(
      password.reset({
        token,
        newPassword: "new-password",
      }),
    ).rejects.toThrow("Invalid password reset token");

    expect(
      repository.passwordCredential.findByResetTokenHash,
    ).toHaveBeenCalledWith(new PasswordResetToken(token).hash(utilities));
  });

  it("有効なreset tokenでpasswordを変更してAggregateを保存する", async () => {
    const repository = createRepository();
    const utilities = new NodeUtilities();
    const delivery = createDelivery();
    const account = await createAccount(utilities);

    const { credential, token } = PasswordCredential.generate({
      account,
      utilities,
      expiresAt: new Date(Date.now() + 60_000),
    });

    vi.mocked(
      repository.passwordCredential.findByResetTokenHash,
    ).mockResolvedValue(credential);

    const password = createPassword({
      repository,
      utilities,
      delivery,
    });

    await password.reset({
      token,
      newPassword: "new-password",
    });

    expect(repository.passwordCredential.save).toHaveBeenCalledTimes(1);

    const updated = vi.mocked(repository.passwordCredential.save).mock
      .calls[0][0];

    expect(updated.reset?.enabled).toBe(false);

    expect(updated.account.identity).toBeInstanceOf(EmailPasswordIdentity);

    if (!(updated.account.identity instanceof EmailPasswordIdentity)) {
      throw new Error("Expected EmailPasswordIdentity");
    }

    const newPassword = new Password("new-password", utilities, "pepper", 300);

    const oldPassword = new Password("old-password", utilities, "pepper", 300);

    expect(
      await updated.account.identity.verify(newPassword, updated.account.id),
    ).toBe(true);

    expect(
      await updated.account.identity.verify(oldPassword, updated.account.id),
    ).toBe(false);
  });

  it("使用済みreset tokenを拒否する", async () => {
    const repository = createRepository();
    const utilities = new NodeUtilities();
    const delivery = createDelivery();
    const account = await createAccount(utilities);

    const { credential, token } = PasswordCredential.generate({
      account,
      utilities,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const usedCredential = new PasswordCredential({
      account: credential.account,
      reset: credential.reset?.disable() ?? null,
    });

    vi.mocked(
      repository.passwordCredential.findByResetTokenHash,
    ).mockResolvedValue(usedCredential);

    const password = createPassword({
      repository,
      utilities,
      delivery,
    });

    await expect(
      password.reset({
        token,
        newPassword: "new-password",
      }),
    ).rejects.toThrow("Invalid password reset token");

    expect(repository.passwordCredential.save).not.toHaveBeenCalled();
  });

  it("期限切れreset tokenを拒否する", async () => {
    const repository = createRepository();
    const utilities = new NodeUtilities();
    const delivery = createDelivery();
    const account = await createAccount(utilities);

    const { credential, token } = PasswordCredential.generate({
      account,
      utilities,
      expiresAt: new Date(Date.now() - 1),
    });

    vi.mocked(
      repository.passwordCredential.findByResetTokenHash,
    ).mockResolvedValue(credential);

    const password = createPassword({
      repository,
      utilities,
      delivery,
    });

    await expect(
      password.reset({
        token,
        newPassword: "new-password",
      }),
    ).rejects.toThrow("Invalid password reset token");

    expect(repository.passwordCredential.save).not.toHaveBeenCalled();
  });

  it("Password Reset未設定ではAppsScriptAuthPasswordを生成できない", () => {
    const repository = createRepository();
    const utilities = new NodeUtilities();

    expect(
      () =>
        new AppsScriptAuthPassword({
          repository,
          utilities,
          emailPassword: new EmailPasswordAuthConfig({
            enabled: true,
            pepper: "pepper",
          }),
        }),
    ).toThrow("Password reset is not enabled");
  });
});

import {
  Account,
  EmailPasswordIdentity,
  HashedPassword,
  PasswordCredential,
  PasswordReset,
  authPattern,
  type AuthSchema,
} from "@gasboost/auth";
import { InMemoryCacheService } from "@gasboost/fake-core";
import { NodeUtilities } from "@gasboost/fake-node";
import { SheetDB } from "@gasboost/sheetorm";
import { describe, expect, it, vi } from "vitest";

import { createAuthSchema } from "../src/createAuthSchema";
import { SheetOrmAuthRepository } from "../src/SheetOrmAuthRepository";
import { TestGateway } from "./TestGateway";

const authSchema = {
  dbId: "auth-db",

  user: {
    modelName: "user",
    fields: {
      id: "id",
      name: "name",
    },
  },

  account: {
    modelName: "account",
    fields: {
      id: "id",
      userId: "userId",
      provider: "provider",
      providerAccountId: "providerAccountId",
      passwordHash: "passwordHash",
    },
  },

  passwordReset: {
    modelName: "passwordReset",
    fields: {
      id: "id",
      accountId: "accountId",
      tokenHash: "tokenHash",
      expiresAt: "expiresAt",
      enabled: "enabled",
    },
  },
} as const satisfies AuthSchema;

function createRepository() {
  const tables = createAuthSchema(authSchema);
  const gateway = new TestGateway();
  const utilities = new NodeUtilities();

  const db = new SheetDB({
    tables,
    gateway,
    cacheService: new InMemoryCacheService(),
    utilities,
  });

  const repository = new SheetOrmAuthRepository({
    db,
    schema: authSchema,
    tables,
  });

  return {
    db,
    gateway,
    repository,
    utilities,
  };
}

function createAccount(passwordHash = "old-password-hash"): Account {
  return new Account({
    id: "account-1",
    userId: "user-1",
    identity: new EmailPasswordIdentity({
      accountId: "taro@example.com",
      password: new HashedPassword({
        value: passwordHash,
      }),
    }),
  });
}

async function seedAccount({
  db,
  account,
}: {
  db: ReturnType<typeof createRepository>["db"];
  account: Account;
}) {
  if (!(account.identity instanceof EmailPasswordIdentity)) {
    throw new Error("Expected EmailPasswordIdentity");
  }

  db.table("account").create([
    {
      id: account.id,
      userId: account.userId,
      provider: authPattern.emailPassword,
      providerAccountId: account.identity.accountId,
      passwordHash: account.identity.password.value,
    },
  ]);
}

describe("SheetOrmPasswordCredentialRepository", () => {
  it("PasswordCredentialを保存できる", async () => {
    const { db, repository, utilities } = createRepository();

    const account = createAccount();

    await seedAccount({
      db,
      account,
    });

    const { credential } = PasswordCredential.generate({
      account,
      utilities,
      expiresAt: new Date("2026-09-10T12:00:00+09:00"),
    });

    await repository.passwordCredential.save(credential);

    const resets = db.table("passwordReset").find();

    expect(resets).toHaveLength(1);

    expect(resets[0]).toEqual({
      id: credential.reset?.id,
      accountId: "account-1",
      tokenHash: credential.reset?.tokenHash,
      expiresAt: new Date("2026-09-10T12:00:00+09:00"),
      enabled: true,
    });
  });

  it("tokenHashからPasswordCredentialを復元できる", async () => {
    const { db, repository, utilities } = createRepository();

    const account = createAccount();

    await seedAccount({
      db,
      account,
    });

    const { credential, token } = PasswordCredential.generate({
      account,
      utilities,
      expiresAt: new Date("2026-09-10T12:00:00+09:00"),
    });

    await repository.passwordCredential.save(credential);

    if (credential.reset === null) {
      throw new Error("Expected PasswordReset");
    }

    const result = await repository.passwordCredential.findByResetTokenHash(
      credential.reset.tokenHash,
    );

    expect(result).not.toBeNull();

    expect(result?.account.id).toBe("account-1");
    expect(result?.account.userId).toBe("user-1");

    expect(result?.account.identity).toBeInstanceOf(EmailPasswordIdentity);

    if (!(result?.account.identity instanceof EmailPasswordIdentity)) {
      throw new Error("Expected EmailPasswordIdentity");
    }

    expect(result.account.identity.accountId).toBe("taro@example.com");

    expect(result.account.identity.password.value).toBe("old-password-hash");

    expect(result.reset?.id).toBe(credential.reset.id);
    expect(result.reset?.accountId).toBe("account-1");
    expect(result.reset?.tokenHash).toBe(credential.reset.tokenHash);
    expect(result.reset?.enabled).toBe(true);

    expect(result.reset?.verify(token, utilities)).toBe(true);
  });

  it("tokenHashが存在しない場合はnullを返す", async () => {
    const { repository } = createRepository();

    await expect(
      repository.passwordCredential.findByResetTokenHash("not-found"),
    ).resolves.toBeNull();
  });

  it("PasswordCredential保存時にpasswordHashを更新できる", async () => {
    const { db, repository, utilities } = createRepository();

    const account = createAccount();

    await seedAccount({
      db,
      account,
    });

    const { credential, token } = PasswordCredential.generate({
      account,
      utilities,
      expiresAt: new Date("2026-09-10T12:00:00+09:00"),
    });

    await repository.passwordCredential.save(credential);

    const updatedCredential = credential.resetPassword({
      token,
      newPassword: new HashedPassword({
        value: "new-password-hash",
      }),
      utilities,
      now: new Date("2026-09-10T11:00:00+09:00"),
    });

    await repository.passwordCredential.save(updatedCredential);

    const [accountRecord] = db.table("account").find();

    expect(accountRecord.passwordHash).toBe("new-password-hash");
  });

  it("PasswordCredential保存時にPasswordResetを無効化できる", async () => {
    const { db, repository, utilities } = createRepository();

    const account = createAccount();

    await seedAccount({
      db,
      account,
    });

    const { credential, token } = PasswordCredential.generate({
      account,
      utilities,
      expiresAt: new Date("2026-09-10T12:00:00+09:00"),
    });

    await repository.passwordCredential.save(credential);

    const updatedCredential = credential.resetPassword({
      token,
      newPassword: new HashedPassword({
        value: "new-password-hash",
      }),
      utilities,
      now: new Date("2026-09-10T11:00:00+09:00"),
    });

    await repository.passwordCredential.save(updatedCredential);

    const resets = db.table("passwordReset").find();

    expect(resets).toHaveLength(1);
    expect(resets[0].enabled).toBe(false);
  });

  it("password更新とPasswordReset無効化を同時に保存できる", async () => {
    const { db, repository, utilities } = createRepository();

    const account = createAccount();

    await seedAccount({
      db,
      account,
    });

    const { credential, token } = PasswordCredential.generate({
      account,
      utilities,
      expiresAt: new Date("2026-09-10T12:00:00+09:00"),
    });

    await repository.passwordCredential.save(credential);

    const updatedCredential = credential.resetPassword({
      token,
      newPassword: new HashedPassword({
        value: "new-password-hash",
      }),
      utilities,
      now: new Date("2026-09-10T11:00:00+09:00"),
    });

    await repository.passwordCredential.save(updatedCredential);

    const [accountRecord] = db.table("account").find();

    const [resetRecord] = db.table("passwordReset").find();

    expect(accountRecord.passwordHash).toBe("new-password-hash");

    expect(resetRecord.enabled).toBe(false);
  });

  it("AccountとPasswordResetを同一transaction内で保存する", async () => {
    const { db, repository, utilities } = createRepository();

    const account = createAccount();

    await seedAccount({
      db,
      account,
    });

    const { credential } = PasswordCredential.generate({
      account,
      utilities,
      expiresAt: new Date("2026-09-10T12:00:00+09:00"),
    });

    const originalTransaction = db.transaction.bind(db);

    let transactionRunning = false;
    const writeStates: boolean[] = [];

    vi.spyOn(db, "transaction").mockImplementation((callback) =>
      originalTransaction(() => {
        transactionRunning = true;

        try {
          return callback();
        } finally {
          transactionRunning = false;
        }
      }),
    );

    const originalUpdate = db.update.bind(db);

    vi.spyOn(db, "update").mockImplementation((records) => {
      writeStates.push(transactionRunning);

      return originalUpdate(records);
    });

    const originalUpsert = db.upsert.bind(db);

    vi.spyOn(db, "upsert").mockImplementation((records) => {
      writeStates.push(transactionRunning);

      return originalUpsert(records);
    });

    await repository.passwordCredential.save(credential);

    expect(db.transaction).toHaveBeenCalledTimes(1);

    expect(writeStates).toEqual([true, true]);
  });

  it("保存後に再取得すると更新後のAggregateを復元できる", async () => {
    const { db, repository, utilities } = createRepository();

    const account = createAccount();

    await seedAccount({
      db,
      account,
    });

    const { credential, token } = PasswordCredential.generate({
      account,
      utilities,
      expiresAt: new Date("2026-09-10T12:00:00+09:00"),
    });

    await repository.passwordCredential.save(credential);

    const updatedCredential = credential.resetPassword({
      token,
      newPassword: new HashedPassword({
        value: "new-password-hash",
      }),
      utilities,
      now: new Date("2026-09-10T11:00:00+09:00"),
    });

    await repository.passwordCredential.save(updatedCredential);

    if (updatedCredential.reset === null) {
      throw new Error("Expected PasswordReset");
    }

    const restored = await repository.passwordCredential.findByResetTokenHash(
      updatedCredential.reset.tokenHash,
    );

    expect(restored).not.toBeNull();

    expect(restored?.reset?.enabled).toBe(false);

    if (!(restored?.account.identity instanceof EmailPasswordIdentity)) {
      throw new Error("Expected EmailPasswordIdentity");
    }

    expect(restored.account.identity.password.value).toBe("new-password-hash");
  });

  it("EmailPasswordIdentity以外は保存を拒否する", async () => {
    const { repository } = createRepository();

    const credential = new PasswordCredential({
      account: new Account({
        id: "account-1",
        userId: "user-1",
        identity: {
          providerName: authPattern.appsScript,
          accountId: "taro@example.com",
        },
      }),
      reset: new PasswordReset({
        id: "reset-1",
        accountId: "account-1",
        tokenHash: "token-hash",
        expiresAt: new Date("2026-09-10T12:00:00+09:00"),
        enabled: true,
      }),
    });

    await expect(
      repository.passwordCredential.save(credential),
    ).rejects.toThrow("Invalid account identity");
  });
});

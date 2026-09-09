import {
  Account,
  AppsScriptIdentity,
  EmailPasswordIdentity,
  HashedPassword,
  User,
  authPattern,
  type AuthSchema,
} from "@gasboost/auth";
import { InMemoryCacheService } from "@gasboost/fake-core";
import { NodeUtilities } from "@gasboost/fake-node";
import { SheetDB } from "@gasboost/sheetorm";
import { describe, expect, it, vi } from "vitest";

import { createAuthSchema } from "../src/createAuthSchema";
import { SheetOrmAuthRepository } from "../src/SheetOrmAuthRepository";

class TestGateway {
  public readonly records = new Map<string, Record<string, unknown>[]>();

  public currentTable = "";

  public table(sheetName: string, dbId: string): void {
    this.currentTable = `${dbId}:${sheetName}`;

    if (!this.records.has(this.currentTable)) {
      this.records.set(this.currentTable, []);
    }
  }

  public read(): Record<string, unknown>[] {
    return (this.records.get(this.currentTable) ?? []).map((record) => ({
      ...record,
    }));
  }

  public insert(records: Record<string, unknown>[]): void {
    const current = this.records.get(this.currentTable) ?? [];

    current.push(
      ...records.map((record) => ({
        ...record,
      })),
    );

    this.records.set(this.currentTable, current);
  }

  public rewrite(records: Record<string, unknown>[]): void {
    this.records.set(
      this.currentTable,
      records.map((record) => ({
        ...record,
      })),
    );
  }

  public setColumns(): void {}

  public count(): number {
    return (this.records.get(this.currentTable) ?? []).length;
  }

  public lastId(pk: string): number {
    const records = this.records.get(this.currentTable) ?? [];

    return records.reduce((max, record) => {
      const value = record[pk];

      return typeof value === "number" ? Math.max(max, value) : max;
    }, 0);
  }

  public protect(): void {}
}

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
} as const satisfies AuthSchema;

function createRepository() {
  const tables = createAuthSchema(authSchema);

  const gateway = new TestGateway();

  const db = new SheetDB({
    tables,
    gateway,
    cacheService: new InMemoryCacheService(),
    utilities: new NodeUtilities(),
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
  };
}

function createUser() {
  const emailAccount = new Account({
    id: "account-email",
    userId: "user-1",
    identity: new EmailPasswordIdentity({
      accountId: "taro@example.com",
      password: new HashedPassword({
        value: "hashed-password",
      }),
    }),
  });

  const appsScriptAccount = new Account({
    id: "account-apps-script",
    userId: "user-1",
    identity: new AppsScriptIdentity({
      googleAccountAddress: "taro@example.com",
    }),
  });

  return new User({
    id: "user-1",
    name: "Taro",
    accounts: [emailAccount, appsScriptAccount],
  });
}

describe("SheetOrmAuthRepository", () => {
  describe("user.create", () => {
    it("UserとAccountを保存できる", async () => {
      const { db, repository } = createRepository();

      const user = createUser();

      const result = await repository.user.create(user);

      expect(result).toBe(user);

      const users = db.table("user").find();

      expect(users).toEqual([
        {
          id: "user-1",
          name: "Taro",
        },
      ]);

      const accounts = db.table("account").find();

      expect(accounts).toHaveLength(2);
    });

    it("emailPassword AccountではpasswordHashを保存する", async () => {
      const { db, repository } = createRepository();

      await repository.user.create(createUser());

      const accounts = db.table("account").find();

      expect(
        accounts.find(
          (account) => account.provider === authPattern.emailPassword,
        ),
      ).toEqual({
        id: "account-email",
        userId: "user-1",
        provider: authPattern.emailPassword,
        providerAccountId: "taro@example.com",
        passwordHash: "hashed-password",
      });
    });

    it("Apps Script AccountではpasswordHashをnullで保存する", async () => {
      const { db, repository } = createRepository();

      await repository.user.create(createUser());

      const accounts = db.table("account").find();

      expect(
        accounts.find((account) => account.provider === authPattern.appsScript),
      ).toEqual({
        id: "account-apps-script",
        userId: "user-1",
        provider: authPattern.appsScript,
        providerAccountId: "taro@example.com",
        passwordHash: null,
      });
    });
  });

  describe("user.find", () => {
    it("Userと複数Accountを復元できる", async () => {
      const { repository } = createRepository();

      await repository.user.create(createUser());

      const user = await repository.user.find("user-1");

      expect(user).not.toBeNull();

      expect(user?.id).toBe("user-1");
      expect(user?.name).toBe("Taro");
      expect(user?.accounts).toHaveLength(2);

      const emailAccount = user?.account(authPattern.emailPassword);

      expect(emailAccount?.id).toBe("account-email");

      expect(emailAccount?.identity).toBeInstanceOf(EmailPasswordIdentity);

      const appsScriptAccount = user?.account(authPattern.appsScript);

      expect(appsScriptAccount?.id).toBe("account-apps-script");

      expect(appsScriptAccount?.identity).toBeInstanceOf(AppsScriptIdentity);
    });

    it("Userが存在しない場合はnullを返す", async () => {
      const { repository } = createRepository();

      await expect(repository.user.find("not-found")).resolves.toBeNull();
    });
  });

  describe("account.findByIdentity", () => {
    it("emailPassword Accountをidentityから取得できる", async () => {
      const { repository } = createRepository();

      await repository.user.create(createUser());

      const account = await repository.account.findByIdentity(
        authPattern.emailPassword,
        "taro@example.com",
      );

      expect(account).not.toBeNull();
      expect(account?.id).toBe("account-email");
      expect(account?.userId).toBe("user-1");

      expect(account?.identity).toBeInstanceOf(EmailPasswordIdentity);

      const identity = account?.identity;

      if (!(identity instanceof EmailPasswordIdentity)) {
        throw new Error("Expected EmailPasswordIdentity");
      }

      expect(identity.accountId).toBe("taro@example.com");

      expect(identity.password.value).toBe("hashed-password");
    });

    it("Apps Script Accountをidentityから取得できる", async () => {
      const { repository } = createRepository();

      await repository.user.create(createUser());

      const account = await repository.account.findByIdentity(
        authPattern.appsScript,
        "taro@example.com",
      );

      expect(account).not.toBeNull();

      expect(account?.id).toBe("account-apps-script");

      expect(account?.identity).toBeInstanceOf(AppsScriptIdentity);

      expect(account?.identity.accountId).toBe("taro@example.com");
    });

    it("identityが存在しない場合はnullを返す", async () => {
      const { repository } = createRepository();

      await expect(
        repository.account.findByIdentity(
          authPattern.emailPassword,
          "nobody@example.com",
        ),
      ).resolves.toBeNull();
    });

    it("UserとAccountを同一transaction内で保存する", async () => {
      const { db, repository } = createRepository();

      const transactionSpy = vi.spyOn(db, "transaction");
      const createSpy = vi.spyOn(db, "create");

      await repository.user.create(createUser());

      expect(transactionSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledTimes(2);

      const transactionCallOrder = transactionSpy.mock.invocationCallOrder[0];

      const firstCreateCallOrder = createSpy.mock.invocationCallOrder[0];

      const secondCreateCallOrder = createSpy.mock.invocationCallOrder[1];

      expect(transactionCallOrder).toBeLessThan(firstCreateCallOrder);

      expect(transactionCallOrder).toBeLessThan(secondCreateCallOrder);
    });
  });
});

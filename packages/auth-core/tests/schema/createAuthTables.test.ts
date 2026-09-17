import type { KeyedTableDefinition } from "@gasboost/table";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import { createAuthTables } from "../../src/schema/createAuthTables";

describe("createAuthTables", () => {
  it("SheetORMに依存しない名前付きtable definitionを返す", () => {
    const tables = createAuthTables();

    expect(Object.keys(tables)).toEqual([
      "schema",
      "user",
      "account",
      "passwordReset",
    ]);
    expect(tables.schema).toEqual({
      user: {
        modelName: "user",
        fields: { id: "id", name: "name" },
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
    });
    expect(tables.user.name).toBe("user");
    expect(tables.user.primaryKey).toBe("id");
    expect(tables.account.name).toBe("account");
    expect(tables.account.primaryKey).toBe("id");
    expect(tables.passwordReset.name).toBe("passwordReset");
    expect(tables.passwordReset.primaryKey).toBe("id");
    expect("dbId" in tables.user).toBe(false);

    expectTypeOf(tables.user).toMatchTypeOf<KeyedTableDefinition>();
    expectTypeOf(tables.account).toMatchTypeOf<KeyedTableDefinition>();
    expectTypeOf(tables.passwordReset).toMatchTypeOf<KeyedTableDefinition>();
  });

  it("default schemaで認証recordを検証できる", () => {
    const tables = createAuthTables();

    expect(tables.user.schema.parse({ id: "u1", name: "Taro" })).toEqual({
      id: "u1",
      name: "Taro",
    });
    expect(
      tables.account.schema.parse({
        id: "a1",
        userId: "u1",
        provider: "emailPassword",
        providerAccountId: "taro@example.com",
        passwordHash: null,
      }),
    ).toEqual({
      id: "a1",
      userId: "u1",
      provider: "emailPassword",
      providerAccountId: "taro@example.com",
      passwordHash: null,
    });
    expect(
      tables.passwordReset.schema.parse({
        id: "r1",
        accountId: "a1",
        tokenHash: "hash",
        expiresAt: new Date("2030-01-01"),
        enabled: true,
      }),
    ).toBeDefined();

    expect(() =>
      tables.account.schema.parse({
        id: "a1",
        userId: "u1",
        provider: "unknown",
        providerAccountId: "x",
        passwordHash: null,
      }),
    ).toThrow(z.ZodError);
  });

  it("model名とfield名を部分的に変更しliteral型を保持する", () => {
    const tables = createAuthTables({
      user: {
        modelName: "members",
        fields: { id: "memberId", name: "displayName" },
      },
      account: {
        modelName: "credentials",
        fields: { passwordHash: "credentialHash" },
      },
      passwordReset: {
        modelName: "resetTokens",
        fields: { expiresAt: "expires" },
      },
    });

    expectTypeOf(tables.user.name).toEqualTypeOf<"members">();
    expectTypeOf(tables.user.primaryKey).toEqualTypeOf<"memberId">();
    expectTypeOf(tables.account.name).toEqualTypeOf<"credentials">();
    expectTypeOf(tables.passwordReset.name).toEqualTypeOf<"resetTokens">();
    expectTypeOf(tables.schema.user.fields.id).toEqualTypeOf<"memberId">();

    expect(
      tables.user.schema.parse({ memberId: "u1", displayName: "Taro" }),
    ).toEqual({ memberId: "u1", displayName: "Taro" });
    expect(tables.account.schema.keyof().options).toContain("credentialHash");
    expect(tables.passwordReset.schema.keyof().options).toContain("expires");
  });

  it.each([
    [{ user: { fields: { id: "same", name: "same" } } }, "user"],
    [{ account: { fields: { id: "same", userId: "same" } } }, "account"],
    [
      {
        passwordReset: {
          fields: { id: "same", accountId: "same" },
        },
      },
      "passwordReset",
    ],
  ] as const)("重複field名を拒否する", (options, modelName) => {
    expect(() => createAuthTables(options)).toThrow(
      `Field names for '${modelName}' must be unique.`,
    );
  });
});

import { type AuthSchema } from "@gasboost/auth";
import { describe, expect, it } from "vitest";

import { createAuthSchema } from "../src/createAuthSchema";

describe("createAuthSchema", () => {
  it("AuthSchemaからuserとaccountのSheetTableを生成する", () => {
    const schema = {
      dbId: "spreadsheet-id",

      user: {
        modelName: "members",
        fields: {
          id: "memberId",
          name: "displayName",
        },
      },

      account: {
        modelName: "authAccounts",
        fields: {
          id: "accountId",
          userId: "memberId",
          provider: "authProvider",
          providerAccountId: "providerUserId",
          passwordHash: "passwordHash",
        },
      },
    } as const satisfies AuthSchema;

    const [userTable, accountTable] = createAuthSchema(schema);

    expect(userTable.dbId).toBe("spreadsheet-id");

    expect(userTable.name).toBe("members");

    expect(userTable.primaryKey).toBe("memberId");

    expect(Object.keys(userTable.schema.shape)).toEqual([
      "memberId",
      "displayName",
    ]);

    expect(accountTable.dbId).toBe("spreadsheet-id");

    expect(accountTable.name).toBe("authAccounts");

    expect(accountTable.primaryKey).toBe("accountId");

    expect(Object.keys(accountTable.schema.shape)).toEqual([
      "accountId",
      "memberId",
      "authProvider",
      "providerUserId",
      "passwordHash",
    ]);
  });

  it("emailPasswordとappsScriptだけをproviderとして許可する", () => {
    const schema = {
      dbId: "spreadsheet-id",

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

    const [, accountTable] = createAuthSchema(schema);

    expect(
      accountTable.schema.safeParse({
        id: "account-1",
        userId: "user-1",
        provider: "emailPassword",
        providerAccountId: "user@example.com",
        passwordHash: "hash",
      }).success,
    ).toBe(true);

    expect(
      accountTable.schema.safeParse({
        id: "account-1",
        userId: "user-1",
        provider: "appsScript",
        providerAccountId: "user@example.com",
        passwordHash: null,
      }).success,
    ).toBe(true);

    expect(
      accountTable.schema.safeParse({
        id: "account-1",
        userId: "user-1",
        provider: "unknown",
        providerAccountId: "user@example.com",
        passwordHash: null,
      }).success,
    ).toBe(false);
  });

  it("passwordHashはnullを許可する", () => {
    const schema = {
      dbId: "spreadsheet-id",

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

    const [, accountTable] = createAuthSchema(schema);

    const result = accountTable.schema.safeParse({
      id: "account-1",
      userId: "user-1",
      provider: "appsScript",
      providerAccountId: "user@example.com",
      passwordHash: null,
    });

    expect(result.success).toBe(true);
  });
});

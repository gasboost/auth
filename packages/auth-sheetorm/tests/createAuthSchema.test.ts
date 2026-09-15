import { type AuthSchema } from "@gasboost/auth";
import { SheetTable } from "@gasboost/sheetorm";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

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

  it("default field nameの具体型を保持する", () => {
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

    const [_userTable, _accountTable, _passwordResetTable] =
      createAuthSchema(schema);

    type User = z.output<typeof _userTable.schema>;
    type Account = z.output<typeof _accountTable.schema>;
    type PasswordReset = z.output<typeof _passwordResetTable.schema>;

    expectTypeOf<User>().toEqualTypeOf<{
      id: string;
      name: string;
    }>();

    expectTypeOf<Account>().toEqualTypeOf<{
      id: string;
      userId: string;
      provider: "emailPassword" | "appsScript";
      providerAccountId: string;
      passwordHash: string | null;
    }>();

    expectTypeOf<PasswordReset>().toEqualTypeOf<{
      id: string;
      accountId: string;
      tokenHash: string;
      expiresAt: Date;
      enabled: boolean;
    }>();
  });

  it("custom modelNameとfieldNameの具体型を保持する", () => {
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
          id: "authAccountId",
          userId: "memberId",
          provider: "authProvider",
          providerAccountId: "externalAccountId",
          passwordHash: "credentialHash",
        },
      },

      passwordReset: {
        modelName: "resetRequests",
        fields: {
          id: "resetId",
          accountId: "authAccountId",
          tokenHash: "resetTokenHash",
          expiresAt: "expiresOn",
          enabled: "isEnabled",
        },
      },
    } as const satisfies AuthSchema;

    const [userTable, accountTable, passwordResetTable] =
      createAuthSchema(schema);

    expectTypeOf(userTable.name).toEqualTypeOf<"members">();
    expectTypeOf(accountTable.name).toEqualTypeOf<"authAccounts">();
    expectTypeOf(passwordResetTable.name).toEqualTypeOf<"resetRequests">();

    type User = z.output<typeof userTable.schema>;
    type Account = z.output<typeof accountTable.schema>;
    type PasswordReset = z.output<typeof passwordResetTable.schema>;

    expectTypeOf<User>().toEqualTypeOf<{
      memberId: string;
      displayName: string;
    }>();

    expectTypeOf<Account>().toEqualTypeOf<{
      authAccountId: string;
      memberId: string;
      authProvider: "emailPassword" | "appsScript";
      externalAccountId: string;
      credentialHash: string | null;
    }>();

    expectTypeOf<PasswordReset>().toEqualTypeOf<{
      resetId: string;
      authAccountId: string;
      resetTokenHash: string;
      expiresOn: Date;
      isEnabled: boolean;
    }>();
  });

  it("application tableと同じtupleに混在しても具体型を保持する", () => {
    const authSchema = {
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

    const authTables = createAuthSchema(authSchema);

    const tutorialSchema = z.object({
      id: z.string(),
      userId: z.string(),
      task: z.string(),
      completed: z.boolean(),
      completedAt: z.date().optional(),
    });

    const tutorialTable = new SheetTable({
      dbId: "spreadsheet-id",
      name: "tutorial",
      schema: tutorialSchema,
      primaryKey: "id",
    });

    const _tables = [...authTables, tutorialTable] as const;

    type UserTable = Extract<(typeof _tables)[number], { name: "user" }>;

    type AccountTable = Extract<(typeof _tables)[number], { name: "account" }>;

    type PasswordResetTable = Extract<
      (typeof _tables)[number],
      { name: "passwordReset" }
    >;

    type TutorialTable = Extract<
      (typeof _tables)[number],
      { name: "tutorial" }
    >;

    type User = z.output<UserTable["schema"]>;
    type Account = z.output<AccountTable["schema"]>;
    type PasswordReset = z.output<PasswordResetTable["schema"]>;
    type Tutorial = z.output<TutorialTable["schema"]>;

    expectTypeOf<User>().toEqualTypeOf<{
      id: string;
      name: string;
    }>();

    expectTypeOf<Account>().toEqualTypeOf<{
      id: string;
      userId: string;
      provider: "emailPassword" | "appsScript";
      providerAccountId: string;
      passwordHash: string | null;
    }>();

    expectTypeOf<PasswordReset>().toEqualTypeOf<{
      id: string;
      accountId: string;
      tokenHash: string;
      expiresAt: Date;
      enabled: boolean;
    }>();

    expectTypeOf<Tutorial>().toEqualTypeOf<{
      id: string;
      userId: string;
      task: string;
      completed: boolean;
      completedAt?: Date;
    }>();
  });

  it("user内でfieldNameが重複している場合は拒否する", () => {
    const schema = {
      dbId: "spreadsheet-id",

      user: {
        modelName: "user",
        fields: {
          id: "identity",
          name: "identity",
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

    expect(() => createAuthSchema(schema)).toThrow(
      "Field names for 'user' must be unique.",
    );
  });

  it("account内でfieldNameが重複している場合は拒否する", () => {
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
          provider: "credential",
          providerAccountId: "providerAccountId",
          passwordHash: "credential",
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

    expect(() => createAuthSchema(schema)).toThrow(
      "Field names for 'account' must be unique.",
    );
  });

  it("passwordReset内でfieldNameが重複している場合は拒否する", () => {
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

      passwordReset: {
        modelName: "passwordReset",
        fields: {
          id: "id",
          accountId: "accountId",
          tokenHash: "tokenHash",
          expiresAt: "state",
          enabled: "state",
        },
      },
    } as const satisfies AuthSchema;

    expect(() => createAuthSchema(schema)).toThrow(
      "Field names for 'passwordReset' must be unique.",
    );
  });
});

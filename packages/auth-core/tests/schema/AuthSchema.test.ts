import { describe, expect, expectTypeOf, it } from "vitest";

import { AuthSchemaConfig } from "../../src/schema/AuthSchema";

describe("AuthSchemaConfig", () => {
  it("user/account設定を省略するとdefault schemaを返す", () => {
    const config = new AuthSchemaConfig({
      dbId: "spreadsheet-id",
    });

    expect(config.schema).toEqual({
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
    });
  });

  it("default schemaのliteral型を保持する", () => {
    const config = new AuthSchemaConfig({
      dbId: "spreadsheet-id",
    });

    expectTypeOf(config.schema.dbId).toEqualTypeOf<"spreadsheet-id">();

    expectTypeOf(config.schema.user.modelName).toEqualTypeOf<"user">();
    expectTypeOf(config.schema.user.fields.id).toEqualTypeOf<"id">();
    expectTypeOf(config.schema.user.fields.name).toEqualTypeOf<"name">();

    expectTypeOf(config.schema.account.modelName).toEqualTypeOf<"account">();
    expectTypeOf(config.schema.account.fields.id).toEqualTypeOf<"id">();
    expectTypeOf(config.schema.account.fields.userId).toEqualTypeOf<"userId">();
    expectTypeOf(
      config.schema.account.fields.provider,
    ).toEqualTypeOf<"provider">();
    expectTypeOf(
      config.schema.account.fields.providerAccountId,
    ).toEqualTypeOf<"providerAccountId">();
    expectTypeOf(
      config.schema.account.fields.passwordHash,
    ).toEqualTypeOf<"passwordHash">();

    expectTypeOf(
      config.schema.passwordReset.modelName,
    ).toEqualTypeOf<"passwordReset">();
    expectTypeOf(config.schema.passwordReset.fields.id).toEqualTypeOf<"id">();
    expectTypeOf(
      config.schema.passwordReset.fields.accountId,
    ).toEqualTypeOf<"accountId">();
    expectTypeOf(
      config.schema.passwordReset.fields.tokenHash,
    ).toEqualTypeOf<"tokenHash">();
    expectTypeOf(
      config.schema.passwordReset.fields.expiresAt,
    ).toEqualTypeOf<"expiresAt">();
    expectTypeOf(
      config.schema.passwordReset.fields.enabled,
    ).toEqualTypeOf<"enabled">();
  });

  it("modelNameをoverrideできる", () => {
    const config = new AuthSchemaConfig({
      dbId: "spreadsheet-id",
      user: {
        modelName: "users",
      },
      account: {
        modelName: "accounts",
      },
    });

    expect(config.schema.dbId).toBe("spreadsheet-id");
    expect(config.schema.user.modelName).toBe("users");
    expect(config.schema.account.modelName).toBe("accounts");
  });

  it("fieldをoverrideできる", () => {
    const config = new AuthSchemaConfig({
      dbId: "spreadsheet-id",
      user: {
        fields: {
          id: "userId",
          name: "displayName",
        },
      },
      account: {
        fields: {
          id: "accountId",
          userId: "ownerId",
          provider: "authProvider",
          providerAccountId: "identifier",
          passwordHash: "credentialHash",
        },
      },
    });

    expect(config.schema.user.fields).toEqual({
      id: "userId",
      name: "displayName",
    });

    expect(config.schema.account.fields).toEqual({
      id: "accountId",
      userId: "ownerId",
      provider: "authProvider",
      providerAccountId: "identifier",
      passwordHash: "credentialHash",
    });
  });

  it("overrideした値のliteral型を保持する", () => {
    const config = new AuthSchemaConfig({
      dbId: "custom-db",
      user: {
        modelName: "members",
        fields: {
          id: "memberId",
          name: "displayName",
        },
      },
      account: {
        modelName: "credentials",
        fields: {
          id: "credentialId",
          userId: "ownerId",
          provider: "authProvider",
          providerAccountId: "externalId",
          passwordHash: "hash",
        },
      },
      passwordReset: {
        modelName: "resetTokens",
        fields: {
          id: "resetId",
          accountId: "credentialId",
          tokenHash: "hash",
          expiresAt: "expires",
          enabled: "active",
        },
      },
    });

    expectTypeOf(config.schema.dbId).toEqualTypeOf<"custom-db">();

    expectTypeOf(config.schema.user.modelName).toEqualTypeOf<"members">();
    expectTypeOf(config.schema.user.fields.id).toEqualTypeOf<"memberId">();
    expectTypeOf(config.schema.user.fields.name).toEqualTypeOf<"displayName">();

    expectTypeOf(
      config.schema.account.modelName,
    ).toEqualTypeOf<"credentials">();
    expectTypeOf(
      config.schema.account.fields.id,
    ).toEqualTypeOf<"credentialId">();
    expectTypeOf(
      config.schema.account.fields.userId,
    ).toEqualTypeOf<"ownerId">();
    expectTypeOf(
      config.schema.account.fields.provider,
    ).toEqualTypeOf<"authProvider">();
    expectTypeOf(
      config.schema.account.fields.providerAccountId,
    ).toEqualTypeOf<"externalId">();
    expectTypeOf(
      config.schema.account.fields.passwordHash,
    ).toEqualTypeOf<"hash">();

    expectTypeOf(
      config.schema.passwordReset.modelName,
    ).toEqualTypeOf<"resetTokens">();
    expectTypeOf(
      config.schema.passwordReset.fields.id,
    ).toEqualTypeOf<"resetId">();
    expectTypeOf(
      config.schema.passwordReset.fields.accountId,
    ).toEqualTypeOf<"credentialId">();
    expectTypeOf(
      config.schema.passwordReset.fields.tokenHash,
    ).toEqualTypeOf<"hash">();
    expectTypeOf(
      config.schema.passwordReset.fields.expiresAt,
    ).toEqualTypeOf<"expires">();
    expectTypeOf(
      config.schema.passwordReset.fields.enabled,
    ).toEqualTypeOf<"active">();
  });

  it("部分的なoverrideでは未指定項目をdefaultにする", () => {
    const config = new AuthSchemaConfig({
      dbId: "spreadsheet-id",
      user: {
        fields: {
          name: "displayName",
        },
      },
      account: {
        fields: {
          passwordHash: "credentialHash",
        },
      },
    });

    expect(config.schema).toEqual({
      dbId: "spreadsheet-id",

      user: {
        modelName: "user",
        fields: {
          id: "id",
          name: "displayName",
        },
      },

      account: {
        modelName: "account",
        fields: {
          id: "id",
          userId: "userId",
          provider: "provider",
          providerAccountId: "providerAccountId",
          passwordHash: "credentialHash",
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
  });

  it("部分overrideでもdefault値のliteral型を保持する", () => {
    const config = new AuthSchemaConfig({
      dbId: "spreadsheet-id",
      user: {
        fields: {
          name: "displayName",
        },
      },
      account: {
        fields: {
          passwordHash: "credentialHash",
        },
      },
    });

    expectTypeOf(config.schema.user.modelName).toEqualTypeOf<"user">();
    expectTypeOf(config.schema.user.fields.id).toEqualTypeOf<"id">();
    expectTypeOf(config.schema.user.fields.name).toEqualTypeOf<"displayName">();

    expectTypeOf(config.schema.account.modelName).toEqualTypeOf<"account">();
    expectTypeOf(config.schema.account.fields.id).toEqualTypeOf<"id">();
    expectTypeOf(config.schema.account.fields.userId).toEqualTypeOf<"userId">();
    expectTypeOf(
      config.schema.account.fields.passwordHash,
    ).toEqualTypeOf<"credentialHash">();
  });
});

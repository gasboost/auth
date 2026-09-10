import { describe, expect, it } from "vitest";

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
});

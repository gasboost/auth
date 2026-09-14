import { AuthSchemaConfig } from "@gasboost/auth";
import { InMemoryCacheService } from "@gasboost/fake-core";
import { NodeUtilities } from "@gasboost/fake-node";
import { SheetDB, SheetTable } from "@gasboost/sheetorm";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createAuthSchema, SheetOrmAuthRepository } from "../src";
import { TestGateway } from "./TestGateway";

describe("AuthSchemaConfig consumer", () => {
  it("AuthSchemaConfigからSheetOrmAuthRepositoryまでpublic APIを接続できる", () => {
    const authSchema = new AuthSchemaConfig({
      dbId: "spreadsheet-id",
    });

    const authTables = createAuthSchema(authSchema.schema);

    const principalTable = new SheetTable({
      dbId: "spreadsheet-id",
      name: "principal",
      schema: z.object({
        email: z.string(),
        name: z.string(),
      }),
      primaryKey: "email",
    });

    const tables = [principalTable, ...authTables] as const;

    const db = new SheetDB({
      tables,
      gateway: new TestGateway(),
      cacheService: new InMemoryCacheService(),
      utilities: new NodeUtilities(),
    });

    const repository = new SheetOrmAuthRepository({
      db,
      schema: authSchema.schema,
      tables,
    });

    expect(repository).toBeInstanceOf(SheetOrmAuthRepository);
  });

  it("overrideしたschemaでもpublic APIを接続できる", () => {
    const authSchema = new AuthSchemaConfig({
      dbId: "spreadsheet-id",

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
          userId: "memberId",
          provider: "authProvider",
          providerAccountId: "externalId",
          passwordHash: "credentialHash",
        },
      },

      passwordReset: {
        modelName: "resetTokens",
        fields: {
          id: "resetId",
          accountId: "credentialId",
          tokenHash: "tokenHash",
          expiresAt: "expiresAt",
          enabled: "enabled",
        },
      },
    });

    const authTables = createAuthSchema(authSchema.schema);

    const principalTable = new SheetTable({
      dbId: "spreadsheet-id",
      name: "principal",
      schema: z.object({
        email: z.string(),
        name: z.string(),
      }),
      primaryKey: "email",
    });

    const tables = [principalTable, ...authTables] as const;

    const db = new SheetDB({
      tables,
      gateway: new TestGateway(),
      cacheService: new InMemoryCacheService(),
      utilities: new NodeUtilities(),
    });

    const repository = new SheetOrmAuthRepository({
      db,
      schema: authSchema.schema,
      tables,
    });

    expect(repository).toBeInstanceOf(SheetOrmAuthRepository);
  });
});

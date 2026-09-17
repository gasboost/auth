import { createAuthTables, type AuthSchema } from "@gasboost/auth";
import { InMemoryCacheService } from "@gasboost/fake-core";
import { NodeUtilities } from "@gasboost/fake-node";
import { SheetDB, SheetTable } from "@gasboost/sheetorm";
import { describe, expect, it } from "vitest";

import { SheetOrmAuthRepository } from "../src";
import { TestGateway } from "./TestGateway";

describe("createAuthTables consumer", () => {
  it("shared definitionをSheetTable化してrepositoryへ接続できる", () => {
    const definitions = createAuthTables({
      user: {
        modelName: "members",
        fields: { id: "memberId", name: "displayName" },
      },
      account: { modelName: "credentials" },
      passwordReset: { modelName: "resetTokens" },
    });

    const tables = [
      new SheetTable({ ...definitions.user, dbId: "auth-db" }),
      new SheetTable({ ...definitions.account, dbId: "auth-db" }),
      new SheetTable({ ...definitions.passwordReset, dbId: "auth-db" }),
    ] as const;

    const db = new SheetDB({
      tables,
      gateway: new TestGateway(),
      cacheService: new InMemoryCacheService(),
      utilities: new NodeUtilities(),
    });

    const schema = {
      user: {
        modelName: "members",
        fields: { id: "memberId", name: "displayName" },
      },
      account: {
        modelName: "credentials",
        fields: {
          id: "id",
          userId: "userId",
          provider: "provider",
          providerAccountId: "providerAccountId",
          passwordHash: "passwordHash",
        },
      },
      passwordReset: {
        modelName: "resetTokens",
        fields: {
          id: "id",
          accountId: "accountId",
          tokenHash: "tokenHash",
          expiresAt: "expiresAt",
          enabled: "enabled",
        },
      },
    } as const satisfies AuthSchema;

    const repository = new SheetOrmAuthRepository({ db, schema });

    expect(repository.user.userTable).toBe(db.definition("members"));
    expect(repository.user.accountTable).toBe(db.definition("credentials"));
    expect(repository.passwordCredential.passwordResetTable).toBe(
      db.definition("resetTokens"),
    );
  });
});

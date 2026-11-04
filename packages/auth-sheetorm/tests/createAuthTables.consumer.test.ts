import { createAuthTables } from "@gasboost/auth";
import { SheetDB, SheetTable } from "@gasboost/sheetorm";
import { describe, expect, it } from "vitest";

import { SheetOrmAuthRepository } from "../src";
import { TestGateway } from "./TestGateway";
import { createRuntime } from "./runtime";

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
      ...createRuntime(),
    });

    const repository = new SheetOrmAuthRepository({
      db,
      schema: definitions.schema,
    });

    expect(repository.user.userTable).toBe(db.definition("members"));
    expect(repository.user.accountTable).toBe(db.definition("credentials"));
    expect(repository.passwordCredential.passwordResetTable).toBe(
      db.definition("resetTokens"),
    );
  });
});

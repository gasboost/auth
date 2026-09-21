import { createAuthorizationTables } from "@gasboost/auth";
import { InMemoryCacheService } from "@gasboost/fake-core";
import { NodeUtilities } from "@gasboost/fake-node";
import { SheetDB, SheetTable } from "@gasboost/sheetorm";
import { describe, expect, it } from "vitest";

import { SheetOrmAuthorizationRepository } from "../src";
import { TestGateway } from "./TestGateway";

function createRepository() {
  const definitions = createAuthorizationTables();
  const tables = [
    new SheetTable({ ...definitions.role, dbId: "auth-db" }),
    new SheetTable({ ...definitions.permission, dbId: "auth-db" }),
  ] as const;

  const gateway = new TestGateway();

  const db = new SheetDB({
    tables,
    gateway,
    cacheService: new InMemoryCacheService(),
    utilities: new NodeUtilities(),
  });

  const repository = new SheetOrmAuthorizationRepository({
    db,
    schema: definitions.schema,
  });

  return {
    db,
    repository,
  };
}

describe("SheetOrmAuthorizationRepository", () => {
  it("role assignmentを保存・取得・削除できる", async () => {
    const { db, repository } = createRepository();

    await repository.role.assign("user-1", "manager");
    await repository.role.assign("user-1", "member");
    await repository.role.assign("user-2", "admin");

    expect(db.table("authorizationRole").find()).toEqual([
      {
        id: "user-1:manager",
        userId: "user-1",
        role: "manager",
      },
      {
        id: "user-1:member",
        userId: "user-1",
        role: "member",
      },
      {
        id: "user-2:admin",
        userId: "user-2",
        role: "admin",
      },
    ]);
    await expect(repository.role.findByUserId("user-1")).resolves.toEqual([
      "manager",
      "member",
    ]);

    await repository.role.revoke("user-1", "manager");

    await expect(repository.role.findByUserId("user-1")).resolves.toEqual([
      "member",
    ]);
  });

  it("permission overrideを保存・取得・削除できる", async () => {
    const { db, repository } = createRepository();

    await repository.permission.set("user-1", "project:update", "deny");
    await repository.permission.set("user-1", "project:delete", "allow");
    await repository.permission.set("user-2", "project:read", "allow");

    expect(db.table("authorizationPermission").find()).toEqual([
      {
        id: "user-1:project%3Aupdate",
        userId: "user-1",
        permission: "project:update",
        effect: "deny",
      },
      {
        id: "user-1:project%3Adelete",
        userId: "user-1",
        permission: "project:delete",
        effect: "allow",
      },
      {
        id: "user-2:project%3Aread",
        userId: "user-2",
        permission: "project:read",
        effect: "allow",
      },
    ]);
    await expect(repository.permission.findByUserId("user-1")).resolves.toEqual(
      [
        {
          permission: "project:update",
          effect: "deny",
        },
        {
          permission: "project:delete",
          effect: "allow",
        },
      ],
    );

    await repository.permission.revoke("user-1", "project:update");

    await expect(repository.permission.findByUserId("user-1")).resolves.toEqual(
      [
        {
          permission: "project:delete",
          effect: "allow",
        },
      ],
    );
  });
});

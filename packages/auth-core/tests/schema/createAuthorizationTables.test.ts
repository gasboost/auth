import type { KeyedTableDefinition } from "@gasboost/table";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import { createAuthorizationTables } from "../../src";

describe("createAuthorizationTables", () => {
  it("storage-independentなauthorization table definitionsを返す", () => {
    const tables = createAuthorizationTables();

    expect(Object.keys(tables)).toEqual(["schema", "role", "permission"]);
    expect(tables.schema).toEqual({
      role: {
        modelName: "authorizationRole",
        fields: {
          id: "id",
          userId: "userId",
          role: "role",
        },
      },
      permission: {
        modelName: "authorizationPermission",
        fields: {
          id: "id",
          userId: "userId",
          permission: "permission",
          effect: "effect",
        },
      },
    });
    expect(tables.role.primaryKey).toBe("id");
    expect(tables.permission.primaryKey).toBe("id");
    expect("dbId" in tables.role).toBe(false);

    expectTypeOf(tables.role).toMatchTypeOf<KeyedTableDefinition>();
    expectTypeOf(tables.permission).toMatchTypeOf<KeyedTableDefinition>();
  });

  it("assignment recordを検証できる", () => {
    const tables = createAuthorizationTables();

    expect(
      tables.role.schema.parse({
        id: "u1:manager",
        userId: "u1",
        role: "manager",
      }),
    ).toEqual({
      id: "u1:manager",
      userId: "u1",
      role: "manager",
    });
    expect(
      tables.permission.schema.parse({
        id: "u1:project%3Aupdate",
        userId: "u1",
        permission: "project:update",
        effect: "deny",
      }),
    ).toEqual({
      id: "u1:project%3Aupdate",
      userId: "u1",
      permission: "project:update",
      effect: "deny",
    });
    expect(() =>
      tables.permission.schema.parse({
        id: "x",
        userId: "u1",
        permission: "project:update",
        effect: "unknown",
      }),
    ).toThrow(z.ZodError);
  });

  it("model名とfield名を部分的に変更しliteral型を保持する", () => {
    const tables = createAuthorizationTables({
      role: {
        modelName: "roles",
        fields: {
          userId: "memberId",
        },
      },
      permission: {
        modelName: "permissionOverrides",
        fields: {
          permission: "capability",
        },
      },
    });

    expectTypeOf(tables.role.name).toEqualTypeOf<"roles">();
    expectTypeOf(tables.role.primaryKey).toEqualTypeOf<"id">();
    expectTypeOf(tables.schema.role.fields.userId).toEqualTypeOf<"memberId">();
    expectTypeOf(tables.permission.name).toEqualTypeOf<"permissionOverrides">();
    expectTypeOf(
      tables.schema.permission.fields.permission,
    ).toEqualTypeOf<"capability">();

    expect(
      tables.role.schema.parse({
        id: "u1:manager",
        memberId: "u1",
        role: "manager",
      }),
    ).toEqual({
      id: "u1:manager",
      memberId: "u1",
      role: "manager",
    });
  });

  it.each([
    [{ role: { fields: { id: "same", userId: "same" } } }, "authorizationRole"],
    [
      {
        permission: {
          fields: { id: "same", userId: "same" },
        },
      },
      "authorizationPermission",
    ],
  ] as const)("重複field名を拒否する", (options, modelName) => {
    expect(() => createAuthorizationTables(options)).toThrow(
      `Field names for '${modelName}' must be unique.`,
    );
  });
});

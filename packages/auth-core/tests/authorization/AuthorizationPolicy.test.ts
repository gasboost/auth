import { describe, expect, expectTypeOf, it } from "vitest";

import {
  AuthorizationPolicy,
  type EffectivePermissions,
} from "../../src/authorization";

const policy = new AuthorizationPolicy({
  project: ["read", "create", "update", "delete"],
  authorization: ["manage"],
} as const)
  .linkRole("admin", {
    project: ["read", "create", "update", "delete"],
    authorization: ["manage"],
  })
  .linkRole("manager", {
    project: ["read", "create", "update"],
  })
  .linkRole("member", {
    project: ["read"],
  });

describe("AuthorizationPolicy", () => {
  it("statementからpermission unionを推論する", () => {
    expectTypeOf<typeof policy.$types.permission>().toEqualTypeOf<
      | "project:read"
      | "project:create"
      | "project:update"
      | "project:delete"
      | "authorization:manage"
    >();
  });

  it("linkRoleからrole unionを推論する", () => {
    expectTypeOf<typeof policy.$types.role>().toEqualTypeOf<
      "admin" | "manager" | "member"
    >();
  });

  it("複数roleのgrantをunionする", () => {
    expect(
      policy.resolve({
        roles: ["member", "manager"],
        permissions: [],
      }),
    ).toEqual(["project:read", "project:create", "project:update"]);
  });

  it("unknown roleとunknown permissionはfail closedにする", () => {
    expect(
      policy.resolve({
        roles: ["unknown", "member"],
        permissions: [
          {
            permission: "project:publish",
            effect: "allow",
          },
        ],
      }),
    ).toEqual(["project:read"]);
  });

  it("user permission overrideがrole grantより優先される", () => {
    expect(
      policy.resolve({
        roles: ["manager"],
        permissions: [
          {
            permission: "project:update",
            effect: "deny",
          },
          {
            permission: "project:delete",
            effect: "allow",
          },
        ],
      }),
    ).toEqual(["project:delete", "project:read", "project:create"]);
  });

  it("denyがallowより優先される", () => {
    expect(
      policy.resolve({
        roles: [],
        permissions: [
          {
            permission: "project:update",
            effect: "allow",
          },
          {
            permission: "project:update",
            effect: "deny",
          },
        ],
      }),
    ).toEqual([]);
  });

  it("default denyかつcanはANDで判定する", () => {
    const permissions = policy.resolve({
      roles: ["member"],
      permissions: [],
    });

    expect(
      policy.can(permissions, {
        project: ["read"],
      }),
    ).toBe(true);
    expect(
      policy.can(permissions, {
        project: ["read", "update"],
      }),
    ).toBe(false);
  });

  it("effective permissionsはplain arrayとして返す", () => {
    const permissions = policy.resolve({
      roles: ["member"],
      permissions: [],
    });

    expect(Array.isArray(permissions)).toBe(true);
    expect(permissions).toEqual(JSON.parse(JSON.stringify(permissions)));
    expectTypeOf(permissions).toMatchTypeOf<
      EffectivePermissions<typeof policy.$types.permission>
    >();
  });
});

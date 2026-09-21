import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  AppsScriptAuthorization,
  type AuthorizationRepository,
} from "../../src";
import { AuthorizationPolicy } from "../../src/authorization";

const policy = new AuthorizationPolicy({
  project: ["read", "update", "delete"],
} as const).linkRole("manager", {
  project: ["read", "update"],
});

function createRepository(): AuthorizationRepository {
  return {
    role: {
      findByUserId: vi.fn().mockResolvedValue(["manager", "unknown"]),
      assign: vi.fn().mockResolvedValue(undefined),
      revoke: vi.fn().mockResolvedValue(undefined),
    },
    permission: {
      findByUserId: vi.fn().mockResolvedValue([
        {
          permission: "project:update",
          effect: "deny",
        },
        {
          permission: "project:delete",
          effect: "allow",
        },
      ]),
      set: vi.fn().mockResolvedValue(undefined),
      revoke: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe("AppsScriptAuthorization", () => {
  it("repository-backedなresolve/canを提供する", async () => {
    const repository = createRepository();
    const authorization = new AppsScriptAuthorization({
      policy,
      repository,
    });

    await expect(authorization.resolve("user-1")).resolves.toEqual([
      "project:delete",
      "project:read",
    ]);
    await expect(
      authorization.can("user-1", {
        project: ["delete"],
      }),
    ).resolves.toBe(true);
    await expect(
      authorization.can("user-1", {
        project: ["update"],
      }),
    ).resolves.toBe(false);
  });

  it("assignment APIをrepositoryへ委譲する", async () => {
    const repository = createRepository();
    const authorization = new AppsScriptAuthorization({
      policy,
      repository,
    });

    await authorization.role.assign("user-1", "manager");
    await authorization.role.revoke("user-1", "manager");
    await authorization.permission.allow("user-1", "project:delete");
    await authorization.permission.deny("user-1", "project:update");
    await authorization.permission.revoke("user-1", "project:update");

    expect(repository.role.assign).toHaveBeenCalledWith("user-1", "manager");
    expect(repository.role.revoke).toHaveBeenCalledWith("user-1", "manager");
    expect(repository.permission.set).toHaveBeenCalledWith(
      "user-1",
      "project:delete",
      "allow",
    );
    expect(repository.permission.set).toHaveBeenCalledWith(
      "user-1",
      "project:update",
      "deny",
    );
    expect(repository.permission.revoke).toHaveBeenCalledWith(
      "user-1",
      "project:update",
    );
  });

  it("assignment APIのrole/permissionをpolicyの型に制約する", () => {
    const authorization = new AppsScriptAuthorization({
      policy,
      repository: createRepository(),
    });

    expectTypeOf(authorization.role.assign)
      .parameter(1)
      .toEqualTypeOf<"manager">();
    expectTypeOf(authorization.permission.allow)
      .parameter(1)
      .toEqualTypeOf<"project:read" | "project:update" | "project:delete">();
  });
});

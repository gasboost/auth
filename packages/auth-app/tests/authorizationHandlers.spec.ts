import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { authorizationHandlers } from "../src";

describe("authorizationHandlers", () => {
  it("master operation handlersを生成するだけで自動登録しない", async () => {
    const service = {
      role: {
        assign: vi.fn().mockResolvedValue(undefined),
        revoke: vi.fn().mockResolvedValue(undefined),
      },
      permission: {
        allow: vi.fn().mockResolvedValue(undefined),
        deny: vi.fn().mockResolvedValue(undefined),
        revoke: vi.fn().mockResolvedValue(undefined),
      },
    };

    const handlers = authorizationHandlers(service);

    await handlers.role.assign({
      userId: "user-1",
      role: "manager",
    });
    await handlers.role.revoke({
      userId: "user-1",
      role: "manager",
    });
    await handlers.permission.allow({
      userId: "user-1",
      permission: "project:delete",
    });
    await handlers.permission.deny({
      userId: "user-1",
      permission: "project:update",
    });
    await handlers.permission.revoke({
      userId: "user-1",
      permission: "project:update",
    });

    expect(service.role.assign).toHaveBeenCalledWith("user-1", "manager");
    expect(service.role.revoke).toHaveBeenCalledWith("user-1", "manager");
    expect(service.permission.allow).toHaveBeenCalledWith(
      "user-1",
      "project:delete",
    );
    expect(service.permission.deny).toHaveBeenCalledWith(
      "user-1",
      "project:update",
    );
    expect(service.permission.revoke).toHaveBeenCalledWith(
      "user-1",
      "project:update",
    );
    expect(Object.keys(handlers)).toEqual(["role", "permission"]);
  });

  it("handler inputのrole/permissionをserviceから推論する", () => {
    const service = {
      role: {
        assign: async (_userId: string, _role: "admin" | "manager") => {},
        revoke: async (_userId: string, _role: "admin" | "manager") => {},
      },
      permission: {
        allow: async (
          _userId: string,
          _permission: "project:read" | "project:update",
        ) => {},
        deny: async (
          _userId: string,
          _permission: "project:read" | "project:update",
        ) => {},
        revoke: async (
          _userId: string,
          _permission: "project:read" | "project:update",
        ) => {},
      },
    };

    const handlers = authorizationHandlers(service);

    expectTypeOf(handlers.role.assign).parameter(0).toEqualTypeOf<{
      readonly userId: string;
      readonly role: "admin" | "manager";
    }>();
    expectTypeOf(handlers.permission.allow).parameter(0).toEqualTypeOf<{
      readonly userId: string;
      readonly permission: "project:read" | "project:update";
    }>();
  });
});

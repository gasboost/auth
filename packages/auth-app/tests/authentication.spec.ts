import {
  AppsScript,
  type InferAppsScript,
  type RpcMetadata,
} from "@gasboost/app";
import type { AppsScriptAuth } from "@gasboost/auth";
import {
  AUTH_METADATA_KEY,
  type AuthMetadata,
} from "@gasboost/auth-client/metadata";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { authentication } from "../src/authentication";
import type { AuthSession } from "../src/AuthState";

type AuthenticationAuth = Parameters<typeof authentication>[0];

function createAuth(get: ReturnType<typeof vi.fn>): AuthenticationAuth {
  return { session: { get } } as unknown as Pick<AppsScriptAuth, "session">;
}

function metadata(token: string): RpcMetadata {
  return { [AUTH_METADATA_KEY]: { token } satisfies AuthMetadata };
}

const session = {
  id: "session-1",
  userId: "user-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  expiresAt: new Date("2027-01-01T00:00:00.000Z"),
};

describe("authentication", () => {
  it("metadataのtokenでsessionを検証し業務inputを変更せずstateへ設定する", async () => {
    const get = vi.fn().mockResolvedValue(session);
    const app = new AppsScript()
      .use(authentication(createAuth(get)))
      .call("updateProfile", (input: { name: string }, context) => {
        const currentSession: AuthSession = context.state.get("session");
        return { input, userId: currentSession.userId };
      });

    type Input = InferAppsScript<typeof app>["updateProfile"]["input"];
    expectTypeOf<Input>().toEqualTypeOf<{ name: string }>();

    const input = { name: "Taro" };
    const response = await app.dispatch(
      "updateProfile",
      input,
      metadata("session-1"),
    );

    expect(get).toHaveBeenCalledExactlyOnceWith("session-1");
    expect(response.contents).toBe(JSON.stringify({ input, userId: "user-1" }));
    expect(input).toEqual({ name: "Taro" });
  });

  it("有効なmetadataがあればinputなしRPCも認証できる", async () => {
    const get = vi.fn().mockResolvedValue(session);
    const app = new AppsScript()
      .use(authentication(createAuth(get)))
      .call(
        "getProfile",
        (_input, context) => context.state.get("session").userId,
      );

    const response = await app.dispatch(
      "getProfile",
      undefined,
      metadata("session-1"),
    );

    expect(get).toHaveBeenCalledExactlyOnceWith("session-1");
    expect(response.contents).toBe(JSON.stringify("user-1"));
  });

  it("業務inputのtokenや別namespaceを認証に使わない", async () => {
    const get = vi.fn().mockResolvedValue(session);
    const input = { token: "business-token" };
    const app = new AppsScript()
      .use(authentication(createAuth(get)))
      .call("getProfile", (value: typeof input) => value);

    const response = await app.dispatch("getProfile", input, {
      ...metadata("session-1"),
      "@my-app/tracing": { token: "other-token" },
    });

    expect(get).toHaveBeenCalledExactlyOnceWith("session-1");
    expect(response.contents).toBe(JSON.stringify(input));
  });

  it.each([
    undefined,
    {},
    { token: "session-1" },
    { "@other/auth": { token: "session-1" } },
    { [AUTH_METADATA_KEY]: undefined },
    { [AUTH_METADATA_KEY]: null },
    { [AUTH_METADATA_KEY]: "session-1" },
    { [AUTH_METADATA_KEY]: 123 },
    { [AUTH_METADATA_KEY]: [] },
    { [AUTH_METADATA_KEY]: ["session-1"] },
    { [AUTH_METADATA_KEY]: {} },
    { [AUTH_METADATA_KEY]: { token: undefined } },
    { [AUTH_METADATA_KEY]: { token: null } },
    { [AUTH_METADATA_KEY]: { token: 123 } },
    { [AUTH_METADATA_KEY]: { token: "" } },
    { [AUTH_METADATA_KEY]: { token: " \t\n" } },
    { [AUTH_METADATA_KEY]: Object.create({ token: "session-1" }) },
    Object.create({
      [AUTH_METADATA_KEY]: { token: "session-1" },
    }) as RpcMetadata,
  ])(
    "missing / invalid metadataをUnauthorizedにする: %j",
    async (invalidMetadata) => {
      const get = vi.fn();
      const handler = vi.fn();
      const app = new AppsScript()
        .use(authentication(createAuth(get)))
        .call("privateRpc", handler);

      // Legacy input tokens must never bypass metadata validation.
      await expect(
        app.dispatch("privateRpc", { token: "session-1" }, invalidMetadata),
      ).rejects.toThrow("Unauthorized");

      expect(get).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it("metadataもinputもない保護対象RPCはUnauthorizedにする", async () => {
    const get = vi.fn();
    const app = new AppsScript()
      .use(authentication(createAuth(get)))
      .call("privateHealth", () => true);
    await expect(app.dispatch("privateHealth")).rejects.toThrow("Unauthorized");
    expect(get).not.toHaveBeenCalled();
  });

  it("存在しない / 期限切れsessionはUnauthorizedにしhandlerを呼ばない", async () => {
    const get = vi.fn().mockResolvedValue(null);
    const handler = vi.fn();
    const app = new AppsScript()
      .use(authentication(createAuth(get)))
      .call("getProfile", handler);

    await expect(
      app.dispatch("getProfile", undefined, metadata("invalid-session")),
    ).rejects.toThrow("Unauthorized");

    expect(get).toHaveBeenCalledExactlyOnceWith("invalid-session");
    expect(handler).not.toHaveBeenCalled();
  });

  it("session serviceのエラーはそのまま伝搬する", async () => {
    const error = new Error("Storage unavailable");
    const get = vi.fn().mockRejectedValue(error);
    const app = new AppsScript()
      .use(authentication(createAuth(get)))
      .call("getProfile", () => true);
    await expect(
      app.dispatch("getProfile", undefined, metadata("session-1")),
    ).rejects.toBe(error);
  });

  it("middlewareより前に登録した公開RPCはmetadataなしで通過する", async () => {
    const get = vi.fn();
    const app = new AppsScript()
      .call("health", () => true)
      .call(
        "signIn",
        (input: { email: string; password: string }) => input.email,
      )
      .use(authentication(createAuth(get)));

    expect((await app.dispatch("health")).contents).toBe("true");
    expect(
      (
        await app.dispatch("signIn", {
          email: "user@example.com",
          password: "password",
        })
      ).contents,
    ).toBe(JSON.stringify("user@example.com"));
    expect(get).not.toHaveBeenCalled();
  });

  it.each(["get", "post"] as const)(
    "call以外の%s invocationは通過する",
    async (type) => {
      const get = vi.fn();
      const next = vi.fn(() => "next");
      const result = await authentication(createAuth(get))(
        {
          invocation: { type, request: {} },
          state: { get: vi.fn(), set: vi.fn() },
        } as never,
        next,
      );
      expect(result).toBe("next");
      expect(next).toHaveBeenCalledOnce();
      expect(get).not.toHaveBeenCalled();
    },
  );
});

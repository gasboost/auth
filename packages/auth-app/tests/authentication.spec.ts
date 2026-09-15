import { AppsScript } from "@gasboost/app";
import type { AppsScriptAuth } from "@gasboost/auth";
import { describe, expect, it, vi } from "vitest";

import type { AuthenticatedInput } from "../src/AuthenticatedInput";
import { authentication } from "../src/authentication";
import type { AuthSession, AuthState } from "../src/AuthState";

type AuthenticationAuth = Parameters<typeof authentication>[0];

function createAuth(get: ReturnType<typeof vi.fn>): AuthenticationAuth {
  return {
    session: {
      get,
    },
  } as unknown as Pick<AppsScriptAuth, "session">;
}

describe("authentication", () => {
  it("tokenからsessionを取得してstateに設定する", async () => {
    const session = {
      id: "session-1",
      userId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    };

    const get = vi.fn().mockResolvedValue(session);
    const auth = createAuth(get);

    const app = new AppsScript<AuthState>();

    app.use(authentication(auth));

    app.call("getProfile", (input: AuthenticatedInput, c) => {
      const currentSession: AuthSession | undefined = c.state.get("session");

      return {
        token: input.token,
        userId: currentSession?.userId,
      };
    });

    const response = await app.dispatch("getProfile", {
      token: "session-1",
    });

    expect(get).toHaveBeenCalledWith("session-1");
    expect(response.contents).toBe(
      JSON.stringify({
        token: "session-1",
        userId: "user-1",
      }),
    );
  });

  it("tokenを持たないRPCはsessionを取得せず通過する", async () => {
    const get = vi.fn();
    const auth = createAuth(get);

    const app = new AppsScript<AuthState>();

    app.use(authentication(auth));

    app.call("signIn", (input: { email: string; password: string }) => {
      return {
        email: input.email,
      };
    });

    const response = await app.dispatch("signIn", {
      email: "user@example.com",
      password: "password",
    });

    expect(get).not.toHaveBeenCalled();
    expect(response.contents).toBe(
      JSON.stringify({
        email: "user@example.com",
      }),
    );
  });

  it("inputなしのRPCはsessionを取得せず通過する", async () => {
    const get = vi.fn();
    const auth = createAuth(get);

    const app = new AppsScript<AuthState>();

    app.use(authentication(auth));

    app.call("health", () => {
      return {
        ok: true,
      };
    });

    const response = await app.dispatch("health");

    expect(get).not.toHaveBeenCalled();
    expect(response.contents).toBe(
      JSON.stringify({
        ok: true,
      }),
    );
  });

  it("call以外のinvocationは通過する", async () => {
    const get = vi.fn();
    const auth = createAuth(get);

    const middleware = authentication(auth);
    const next = vi.fn(() => "next");

    const result = await middleware(
      {
        invocation: {
          type: "get",
          request: {},
        },
        state: {
          get: vi.fn(),
          set: vi.fn(),
        },
      } as never,
      next,
    );

    expect(result).toBe("next");
    expect(next).toHaveBeenCalledOnce();
    expect(get).not.toHaveBeenCalled();
  });

  it("tokenがstringでない場合はUnauthorizedにする", async () => {
    const get = vi.fn();
    const auth = createAuth(get);

    const app = new AppsScript<AuthState>();

    app.use(authentication(auth));

    app.call("getProfile", (_input: AuthenticatedInput) => {
      return {
        ok: true,
      };
    });

    await expect(
      app.dispatch("getProfile", {
        token: 123,
      }),
    ).rejects.toThrow("Unauthorized");

    expect(get).not.toHaveBeenCalled();
  });

  it("sessionが存在しない場合はUnauthorizedにする", async () => {
    const get = vi.fn().mockResolvedValue(null);
    const auth = createAuth(get);

    const app = new AppsScript<AuthState>();

    app.use(authentication(auth));

    app.call("getProfile", (_input: AuthenticatedInput) => {
      return {
        ok: true,
      };
    });

    await expect(
      app.dispatch("getProfile", {
        token: "invalid-session",
      }),
    ).rejects.toThrow("Unauthorized");

    expect(get).toHaveBeenCalledWith("invalid-session");
  });

  it("tokenプロパティが存在しないobject inputは通過する", async () => {
    const get = vi.fn();
    const auth = createAuth(get);

    const app = new AppsScript<AuthState>();

    app.use(authentication(auth));

    app.call("publicRpc", (input: { value: string }) => {
      return input.value;
    });

    const response = await app.dispatch("publicRpc", {
      value: "public",
    });

    expect(get).not.toHaveBeenCalled();
    expect(response.contents).toBe(JSON.stringify("public"));
  });
});

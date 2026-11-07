import {
  AppsScript,
  AppsScriptError,
  type InferAppsScript,
} from "@gasboost/app";
import { AppsScriptAuth } from "@gasboost/auth";
import { AuthError, AUTH_ERROR_CODES } from "@gasboost/auth/errors";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  authErrorHandler,
  authentication,
  authorization,
  handlers,
} from "../src";

const failure = () =>
  new AuthError({
    code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    message: "Invalid credentials",
  });

describe("authErrorHandler", () => {
  it("converts only AuthError into the public RPC error type", async () => {
    await expect(
      authErrorHandler()({} as never, () => {
        throw failure();
      }),
    ).rejects.toBeInstanceOf(AppsScriptError);
    await expect(
      authErrorHandler()({} as never, async () => {
        throw failure();
      }),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "Invalid credentials",
    });
  });

  it.each([
    new Error("internal secret"),
    "internal secret",
    null,
    { code: "FORBIDDEN", message: "secret" },
  ])("rethrows unknown failures unchanged: %s", async (error) => {
    await expect(
      authErrorHandler()({} as never, () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });

  it("preserves successful values", async () => {
    const value = { ok: true };
    await expect(authErrorHandler()({} as never, () => value)).resolves.toBe(
      value,
    );
  });

  it("covers auth handlers and direct Auth API calls in consumer RPCs", async () => {
    const auth = {
      signIn: {
        email: vi.fn().mockRejectedValue(failure()),
        appsScript: vi.fn(),
      },
      signUp: { email: vi.fn(), appsScript: vi.fn() },
      signOut: { execute: vi.fn() },
      session: { getWithUser: vi.fn() },
      password: undefined,
    } as unknown as AppsScriptAuth<undefined>;
    const app = new AppsScript()
      .use(authErrorHandler())
      .calls(handlers(auth))
      .call("consumerSignIn", (input: { email: string; password: string }) =>
        auth.signIn.email(input),
      );
    type Input = InferAppsScript<typeof app>["consumerSignIn"]["input"];
    expectTypeOf<Input>().toEqualTypeOf<{ email: string; password: string }>();
    for (const rpc of ["signInEmail", "consumerSignIn"]) {
      await expect(
        app.dispatch(rpc, { email: "user@example.com", password: "wrong" }),
      ).rejects.toThrow(
        'GASBOOST_RPC_ERROR_V1:{"code":"INVALID_CREDENTIALS","message":"Invalid credentials"}',
      );
    }
  });

  it("exposes unauthenticated and forbidden failures from middleware", async () => {
    const unauthenticated = new AppsScript()
      .use(authErrorHandler())
      .use(
        authentication({ session: { get: vi.fn().mockResolvedValue(null) } }),
      )
      .call("privateRpc", () => true);
    await expect(unauthenticated.dispatch("privateRpc")).rejects.toThrow(
      '"code":"UNAUTHORIZED"',
    );
    const forbidden = new AppsScript()
      .use(authErrorHandler())
      .use(
        authentication({
          session: { get: vi.fn().mockResolvedValue({ userId: "user-1" }) },
        }),
      )
      .use(
        authorization({ can: async () => false }, {
          project: ["read"],
        } as const),
      )
      .call("privateRpc", () => true);
    await expect(
      forbidden.dispatch("privateRpc", undefined, {
        "@gasboost/auth": { token: "session-1" },
      }),
    ).rejects.toThrow('"code":"FORBIDDEN"');
  });

  it("lets the RPC boundary hide unknown errors and respects registration order", async () => {
    const app = new AppsScript()
      .call("before", () => {
        throw failure();
      })
      .use(authErrorHandler())
      .call("after", () => {
        throw new Error("internal secret");
      });
    for (const rpc of ["before", "after"]) {
      await expect(app.dispatch(rpc)).rejects.toThrow(
        'GASBOOST_RPC_ERROR_V1:{"code":"INTERNAL_ERROR","message":"An unexpected error occurred"}',
      );
    }
  });
});

// Exercise the published client's restoration of the server boundary format.
describe("auth errors over local RPC", () => {
  it("restores codes with the standard client transport and hides internal failures", async () => {
    const { FetchTransport, appsScriptClient, AppsScriptRpcError } =
      await import("@gasboost/client");
    const app = new AppsScript()
      .use(authErrorHandler())
      .call("signIn", () => {
        throw failure();
      })
      .call("unknown", () => {
        throw new Error("internal secret");
      })
      .call("success", () => ({ ok: true }));
    vi.stubGlobal("fetch", async (url: string) => {
      try {
        const response = await app.dispatch(
          url.slice(url.lastIndexOf("/") + 1),
        );
        return { ok: true, text: async () => response.contents };
      } catch (error) {
        // Vite / GAS only preserve the standard message; custom fields are gone.
        return {
          ok: false,
          json: async () => ({ error: { message: (error as Error).message } }),
        };
      }
    });
    try {
      const { client } = appsScriptClient<InferAppsScript<typeof app>>({
        transport: new FetchTransport({ endpoint: "/rpc" }),
      });
      await expect(client.signIn()).rejects.toBeInstanceOf(AppsScriptRpcError);
      await expect(client.signIn()).rejects.toMatchObject({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: "Invalid credentials",
      });
      await expect(client.unknown()).rejects.toMatchObject({
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      });
      await expect(client.success()).resolves.toEqual({ ok: true });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

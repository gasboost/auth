import { AppsScript, type InferAppsScript } from "@gasboost/app";
import { AppsScriptAuth, User } from "@gasboost/auth";
import {
  appsScriptClient,
  type MetadataProvider,
  type Transport,
} from "@gasboost/client";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { authentication } from "../../auth-app/src/authentication";
import { handlers } from "../../auth-app/src/handlers";
import { Session } from "../../auth-core/src/domain/Session";
import { memoryAuthStorage, type AuthStorage } from "../src";
import {
  appsScriptAuth,
  appsScriptAuthRemote,
  authMetadataProvider,
} from "../src/appsscript";
import { AUTH_METADATA_KEY, isAuthMetadata } from "../src/metadata";

function setup() {
  const user = new User({ id: "user-1", name: "Taro", accounts: [] });
  const sessions = new Map<string, Session>();
  let nextId = 0;
  function signIn() {
    const session = new Session({
      id: `session-${++nextId}`,
      userId: user.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    });
    sessions.set(session.id, session);
    return { user, session };
  }
  const server = {
    signIn: {
      email: vi.fn(async (_input: { email: string; password: string }) => ({
        ...signIn(),
        hooks: { customToken: "custom" },
      })),
      appsScript: vi.fn(async (_input: Record<string, never>) => ({
        ...signIn(),
        hooks: { customToken: "custom" },
      })),
    },
    signUp: {
      email: vi.fn(
        async (_input: { name: string; email: string; password: string }) => ({
          ...signIn(),
          hooks: { customToken: "custom" },
        }),
      ),
      appsScript: vi.fn(async (_input: { name: string }) => ({
        ...signIn(),
        hooks: { customToken: "custom" },
      })),
    },
    session: { get: vi.fn(async (id: string) => sessions.get(id) ?? null) },
    signOut: {
      execute: vi.fn(async (id: string) => {
        sessions.delete(id);
      }),
    },
  };
  const auth = server as unknown as AppsScriptAuth<
    undefined,
    { customToken: string }
  >;
  const issueCustomToken = vi.fn((userId: string) => `custom:${userId}`);
  const app = new AppsScript()
    .calls(handlers(auth))
    .use(authentication(auth))
    .call("issueFirebaseCustomToken", (_: Record<string, never>, context) => ({
      customToken: issueCustomToken(context.state.get("session").userId),
    }))
    .call(
      "createEmployee",
      (input: { name: string; email: string }, context) => ({
        ...input,
        createdBy: context.state.get("session").userId,
      }),
    );
  const storage = memoryAuthStorage();
  const call = vi.fn<Transport["call"]>((name, input, metadata) =>
    app.dispatch(name, input, metadata),
  );
  const { client } = appsScriptClient<InferAppsScript<typeof app>>({
    transport: { call },
    metadataProviders: [authMetadataProvider(storage)],
  });
  return {
    server,
    issueCustomToken,
    sessions,
    storage,
    call,
    client,
    auth: appsScriptAuth({ client, storage }),
  };
}

describe("authMetadataProvider", () => {
  it("is a MetadataProvider that reads the exact injected storage on every call", () => {
    const storage = memoryAuthStorage();
    const provider: MetadataProvider = authMetadataProvider(storage);
    expect(provider()).toBeUndefined();
    storage.set("session-1");
    expect(provider()).toEqual({ [AUTH_METADATA_KEY]: { token: "session-1" } });
    storage.set("session-2");
    expect(provider()).toEqual({ [AUTH_METADATA_KEY]: { token: "session-2" } });
    storage.remove();
    expect(provider()).toBeUndefined();
  });

  it.each(["", " \n"])("omits empty token %j", (token) => {
    const storage = memoryAuthStorage();
    storage.set(token);
    expect(authMetadataProvider(storage)()).toBeUndefined();
  });

  it("keeps separate consumer storage instances isolated", () => {
    const first = memoryAuthStorage();
    const second = memoryAuthStorage();
    first.set("first");
    expect(authMetadataProvider(first)()).toBeDefined();
    expect(authMetadataProvider(second)()).toBeUndefined();
  });

  it("propagates custom storage errors", () => {
    const error = new Error("Secure storage unavailable");
    const storage: AuthStorage = {
      get: () => {
        throw error;
      },
      set: vi.fn(),
      remove: vi.fn(),
    };
    expect(() => authMetadataProvider(storage)()).toThrow(error);
  });
});

describe("appsScriptAuth with real RPC client, handlers, and middleware", () => {
  it("signs in, preserves typed hook data, and supplies metadata to business RPCs", async () => {
    const { auth, client, storage, call, server } = setup();
    const result = await auth.signIn({
      email: "user@example.com",
      password: "password",
    });
    expect(server.signIn.email.mock.calls[0]?.[0]).toEqual({
      email: "user@example.com",
      password: "password",
    });
    expect(result.hooks.customToken).toBe("custom");
    expectTypeOf(result.hooks.customToken).toEqualTypeOf<string>();
    expectTypeOf(result.user.name).toEqualTypeOf<string>();
    expect(result.token).toBe(result.session.id);
    expect(storage.get()).toBe(result.token);
    const input = { name: "Hanako", email: "hanako@example.com" };
    expect(await client.createEmployee(input)).toEqual({
      ...input,
      createdBy: "user-1",
    });
    const [name, actualInput, metadata] =
      call.mock.calls[call.mock.calls.length - 1]!;
    expect(name).toBe("createEmployee");
    expect(actualInput).toEqual(input);
    expect(metadata).toEqual({ [AUTH_METADATA_KEY]: { token: result.token } });
    expect(isAuthMetadata(metadata?.[AUTH_METADATA_KEY])).toBe(true);
    expectTypeOf<Parameters<typeof client.createEmployee>[0]>().toEqualTypeOf<
      typeof input
    >();
  });

  it("restores persisted sessions using the existing sessionId input contract", async () => {
    const { auth, client, storage, server } = setup();
    const result = await auth.signIn({
      email: "user@example.com",
      password: "password",
    });
    const restored = appsScriptAuth({ client, storage });
    expect(restored.getSession()).toBeNull();
    const session = await restored.restoreSession();
    expect(server.session.get).toHaveBeenCalledWith(result.token);
    expect(session?.token).toBe(result.token);
    expect(session?.session.id).toBe(result.token);
    // getSession returns a session, never the User returned by signIn/signUp.
    expect(restored.getUser()).toBeNull();
    expect(restored.getState().isAuthenticated).toBe(true);
    expect(
      (await client.createEmployee({ name: "Taro", email: "taro@example.com" }))
        .createdBy,
    ).toBe("user-1");
  });

  it("clears invalid persisted tokens without generating a new RPC client", async () => {
    const { auth, storage, client } = setup();
    storage.set("expired");
    expect(await auth.restoreSession()).toBeNull();
    expect(storage.get()).toBeNull();
    await expect(
      client.createEmployee({ name: "Taro", email: "user@example.com" }),
    ).rejects.toThrow("Unauthorized");
  });

  it("signs out the same server session and stops adding auth metadata", async () => {
    const { auth, server, sessions, storage, call, client } = setup();
    const result = await auth.signIn({ email: "user", password: "password" });
    await auth.signOut();
    expect(server.signOut.execute).toHaveBeenCalledWith(result.token);
    expect(sessions.has(result.token)).toBe(false);
    expect(storage.get()).toBeNull();
    expect(auth.getToken()).toBeNull();
    await expect(
      client.createEmployee({ name: "Taro", email: "user" }),
    ).rejects.toThrow("Unauthorized");
    expect(call.mock.calls[call.mock.calls.length - 1]?.[2]).toBeUndefined();
  });

  it("supports both sign-up methods and Apps Script identity sign-in", async () => {
    const { auth, storage, server } = setup();
    await auth.signUp({ name: "Taro", email: "user", password: "password" });
    expect(server.signUp.email.mock.calls[0]?.[0]).toEqual({
      name: "Taro",
      email: "user",
      password: "password",
    });
    await auth.signUpAppsScript({ name: "Taro" });
    expect(server.signUp.appsScript.mock.calls[0]?.[0]).toEqual({
      name: "Taro",
    });
    const result = await auth.signInAppsScript();
    expect(server.signIn.appsScript.mock.calls[0]?.[0]).toEqual({});
    expect(storage.get()).toBe(result.token);
    expect(auth.getUser()?.id).toBe("user-1");
  });

  it("exposes an AuthRemote adapter for custom lifecycle composition", async () => {
    const { client } = setup();
    const remote = appsScriptAuthRemote({ client });
    const session = await remote.signIn({
      provider: "email",
      input: { email: "user", password: "password" },
    });
    expect(await remote.getSession(session.token)).toMatchObject({
      token: session.token,
      user: null,
    });
    await remote.signOut(session.token);
    expect(await remote.getSession(session.token)).toBeNull();
  });
});

describe("consumer authentication hooks", () => {
  it.each([
    "signIn",
    "signUp",
    "signInAppsScript",
    "signUpAppsScript",
  ] as const)(
    "awaits the hook once for %s and persists only the session id",
    async (method) => {
      const { client, storage } = setup();
      let release!: () => void;
      let started!: () => void;
      const entered = new Promise<void>((resolve) => {
        started = resolve;
      });
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      const afterSignIn = vi.fn(
        async ({ hooks }: { hooks: { customToken: string } }) => {
          expect(hooks.customToken).toBe("custom");
          started();
          await pending;
        },
      );
      const auth = appsScriptAuth({ client, storage, hooks: { afterSignIn } });
      const result =
        method === "signInAppsScript"
          ? auth.signInAppsScript()
          : method === "signUpAppsScript"
            ? auth.signUpAppsScript({ name: "Taro" })
            : auth[method]({
                name: "Taro",
                email: "user",
                password: "password",
              });
      await entered;
      expect(storage.get()).toBeNull();
      expect(auth.getState().isAuthenticated).toBe(false);
      release();
      const session = await result;
      expect(afterSignIn).toHaveBeenCalledExactlyOnceWith(session);
      expect(session.hooks.customToken).toBe("custom");
      expectTypeOf(session.hooks.customToken).toEqualTypeOf<string>();
      expect(storage.get()).toBe(session.session.id);
    },
  );

  it.each(["signIn", "signUp"] as const)(
    "revokes the server session when the %s consumer hook fails",
    async (method) => {
      const { client, storage, sessions, server } = setup();
      const error = new Error("Firebase sign-in failed");
      const auth = appsScriptAuth({
        client,
        storage,
        hooks: {
          afterSignIn: async () => {
            throw error;
          },
        },
      });
      await expect(
        auth[method]({ name: "Taro", email: "user", password: "password" }),
      ).rejects.toBe(error);
      expect(sessions.size).toBe(0);
      expect(server.signOut.execute).toHaveBeenCalledOnce();
      expect(server[method].email).toHaveBeenCalledOnce();
      expect(storage.get()).toBeNull();
      expect(auth.getState().isAuthenticated).toBe(false);
    },
  );

  it("runs a consumer hook with a server that has no hook result", async () => {
    const { client, storage } = setup();
    const plainClient = {
      ...client,
      signInEmail: async (_input: { email: string; password: string }) => ({
        user: null,
        session: { id: "plain" },
      }),
      signInAppsScript: async (_input: Record<string, never>) => ({
        user: null,
        session: { id: "plain" },
      }),
      signUpEmail: async (_input: {
        name: string;
        email: string;
        password: string;
      }) => ({ user: null, session: { id: "plain" } }),
      signUpAppsScript: async (_input: { name: string }) => ({
        user: null,
        session: { id: "plain" },
      }),
    };
    const afterSignIn = vi.fn();
    const auth = appsScriptAuth({
      client: plainClient,
      storage,
      hooks: { afterSignIn },
    });
    const result = await auth.signUp({
      name: "Taro",
      email: "user",
      password: "password",
    });
    expect(result).not.toHaveProperty("hooks");
    expect(afterSignIn).toHaveBeenCalledExactlyOnceWith(result);
  });
});

describe("Apps Script external authentication lifecycle", () => {
  it("repairs external auth using the validated GAS user ID", async () => {
    const { client, storage, sessions, server } = setup();
    let externalId: string | null = "other";
    const externalAuth = {
      getUserId: vi.fn(async () => externalId),
      signIn: vi.fn(async (id: string) => {
        externalId = id;
      }),
      signOut: vi.fn(async () => {
        externalId = null;
      }),
    };
    const auth = appsScriptAuth({
      client,
      storage,
      externalAuth,
      getUserId: (result) => {
        expectTypeOf(result.session.userId).toEqualTypeOf<string>();
        return result.session.userId;
      },
    });
    const signedIn = await auth.signIn({ email: "user", password: "password" });
    expect(await auth.isSynced()).toBe(false);
    const result = await auth.sync();
    expect(result.synchronized).toBe(true);
    expect(result.session?.session.userId).toBe("user-1");
    expect(externalAuth.signIn).toHaveBeenCalledExactlyOnceWith("user-1");
    expect(await auth.isSynced()).toBe(true);
    expect(storage.get()).toBe(signedIn.token);
    expect(server.signOut.execute).not.toHaveBeenCalled();
    await auth.signOut();
    expect(sessions.has(signedIn.token)).toBe(false);
    expect(externalAuth.signOut).toHaveBeenCalledExactlyOnceWith();
  });
});

describe("Consumer credential reissuance", () => {
  it("repairs missing Firebase auth with credentials bound to the validated GAS session", async () => {
    const { client, storage, issueCustomToken, auth: original, call } = setup();
    const signedIn = await original.signIn({
      email: "user",
      password: "password",
    });
    let uid: string | null = null;
    const auth = appsScriptAuth({
      client,
      storage,
      getUserId: (result) => result.session.userId,
      externalAuth: {
        getUserId: async () => uid,
        signIn: async () => {
          const { customToken } = await client.issueFirebaseCustomToken({});
          // Consumer SDK stand-in: a signed credential identifies the user.
          uid = customToken.slice("custom:".length);
        },
        signOut: async () => {
          uid = null;
        },
      },
    });
    expect((await auth.sync()).synchronized).toBe(true);
    expect(uid).toBe("user-1");
    expect(issueCustomToken).toHaveBeenCalledExactlyOnceWith("user-1");
    // Malicious input cannot select the token subject; middleware supplies it.
    const forged = await call(
      "issueFirebaseCustomToken",
      { userId: "attacker" },
      {
        [AUTH_METADATA_KEY]: { token: signedIn.token },
      },
    );
    expect(forged).toMatchObject({
      contents: JSON.stringify({ customToken: "custom:user-1" }),
    });
    await auth.signOut();
    await expect(client.issueFirebaseCustomToken({})).rejects.toThrow(
      "Unauthorized",
    );
    storage.set("expired");
    await expect(client.issueFirebaseCustomToken({})).rejects.toThrow(
      "Unauthorized",
    );
    expect(issueCustomToken).toHaveBeenCalledTimes(2);
  });
});

import { AppsScript, type InferAppsScript } from "@gasboost/app";
import {
  AppsScriptAuth,
  type AppsScriptAuthRepository,
  type User,
  type UserDataProvider,
} from "@gasboost/auth";
import { handlers, authentication } from "@gasboost/auth-app";
import { memoryAuthStorage } from "@gasboost/auth-client";
import { appsScriptAuth } from "@gasboost/auth-client/appsscript";
import { appsScriptClient } from "@gasboost/client";
import {
  InMemoryCacheService,
  InMemoryContext,
  InMemoryPropertiesService,
  InMemorySession,
  OAuthScope,
  SecurityPolicy,
} from "@gasboost/fake-core";
import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

function setup<TData>(data: UserDataProvider<TData>) {
  const users = new Map<string, User>();
  const repository = {
    user: {
      find: vi.fn(async (id: string) => users.get(id) ?? null),
      create: vi.fn(async (user: User) => {
        users.set(user.id, user);
        return user;
      }),
    },
    account: {
      findByIdentity: vi.fn(async (provider, identifier) => {
        for (const user of users.values()) {
          const account = user.account(provider);
          if (account?.identity.accountId === identifier) return account;
        }
        return null;
      }),
    },
    passwordCredential: {
      findByResetTokenHash: vi.fn(async () => null),
      save: vi.fn(async () => {}),
    },
  } satisfies AppsScriptAuthRepository;
  const propertiesService = new InMemoryPropertiesService();
  const afterSignIn = vi.fn(() => ({ customToken: "firebase-token" }));
  const server = new AppsScriptAuth({
    repository,
    runtime: {
      utilities: new NodeUtilities(),
      cacheService: new InMemoryCacheService(),
      propertiesService,
      session: new InMemorySession(
        new InMemoryContext(
          "owner@example.com",
          "user@example.com",
          { type: "WEB_APP", executeAs: "USER" },
          new SecurityPolicy([OAuthScope.USERINFO_EMAIL]),
          "ja",
          "Asia/Tokyo",
        ),
      ),
    },
    session: { storageType: "properties" },
    emailPassword: { enabled: true, pepper: "test-pepper", iterations: 1 },
    appsScript: { enabled: true, isSignupEnabled: true },
    hooks: { afterSignIn },
    user: { data },
  });
  const app = new AppsScript()
    .calls(handlers(server))
    .use(authentication(server));
  const { client } = appsScriptClient<InferAppsScript<typeof app>>({
    transport: {
      call: (name, input, metadata) => app.dispatch(name, input, metadata),
    },
  });
  const storage = memoryAuthStorage();
  const externalAuth = {
    getUserId: vi.fn(async () => null as string | null),
    signIn: vi.fn(async (_id: string) => {}),
    signOut: vi.fn(async () => {}),
  };
  const auth = appsScriptAuth({
    client,
    storage,
    externalAuth,
    getUserId: (result) => result.session.userId,
  });
  return {
    server,
    client,
    auth,
    storage,
    externalAuth,
    users,
    repository,
    afterSignIn,
    propertiesService,
  };
}

const credentials = { email: "email@example.com", password: "secret" };
describe("user.data across authentication and RPC restoration", () => {
  it.each([false, true])(
    "infers and resolves sync/async data (async: %s) on all four paths",
    async (asyncData) => {
      let permissions = ["staff:read"];
      const data = vi.fn(({ user }: { user: User }) => {
        const result = { permissions: [...permissions], employee: user.name };
        return asyncData ? Promise.resolve(result) : result;
      });
      const {
        server,
        auth,
        client,
        storage,
        users,
        afterSignIn,
        propertiesService,
        externalAuth,
      } = setup(data);
      const results = [
        await auth.signUp({ name: "Email", ...credentials }),
        await auth.signIn(credentials),
        await auth.signUpAppsScript({ name: "AppsScript" }),
        await auth.signInAppsScript(),
      ];
      for (const result of results) {
        expectTypeOf(result.user.data.permissions).toEqualTypeOf<string[]>();
        expect(result.user.data.permissions).toEqual(["staff:read"]);
        expect(result.hooks.customToken).toBe("firebase-token");
        expect(users.get(result.user.id)).not.toHaveProperty("data");
        expect(await server.session.get(result.token)).not.toHaveProperty(
          "user",
        );
        expect(
          await client.getSession({ sessionId: result.token }),
        ).toMatchObject({ id: result.token, user: result.user });
      }
      expect(afterSignIn).toHaveBeenCalledTimes(4);
      expect(
        JSON.stringify(propertiesService.getScriptProperties().getProperties()),
      ).not.toContain("permissions");
      permissions = ["staff:read", "staff:create"];
      const restored = appsScriptAuth({ client, storage });
      expect((await restored.restoreSession())?.user.data.permissions).toEqual(
        permissions,
      );
      expectTypeOf(restored.getState().user?.data.permissions).toEqualTypeOf<
        string[] | undefined
      >();
      expect(restored.getUser()?.data.permissions).toEqual(permissions);
      expect(afterSignIn).toHaveBeenCalledTimes(4);
      const currentUser = results[3]!.user.id;
      externalAuth.getUserId.mockResolvedValue(currentUser);
      expect((await auth.sync()).synchronized).toBe(true);
      expect(auth.getUser()?.data.permissions).toEqual(permissions);
      expect(externalAuth.signIn).not.toHaveBeenCalled();
      await server.signOut.execute(results[3]!.token);
      expect(await restored.restoreSession()).toBeNull();
      expect(restored.getUser()).toBeNull();
    },
  );

  it("propagates data failures without issuing a session or running sign-in hooks", async () => {
    const error = new Error("User data unavailable");
    const data = vi.fn(() => ({ permissions: ["staff:read"] }));
    const { server, auth, users, afterSignIn, propertiesService } = setup(data);
    const signedUp = await auth.signUp({ name: "Email", ...credentials });
    await server.signOut.execute(signedUp.token);
    data.mockImplementation(() => {
      throw error;
    });
    await expect(auth.signIn(credentials)).rejects.toThrow(
      "User data unavailable",
    );
    await expect(auth.signUpAppsScript({ name: "AppsScript" })).rejects.toThrow(
      "User data unavailable",
    );
    await expect(auth.signInAppsScript()).rejects.toThrow(
      "User data unavailable",
    );
    await expect(
      auth.signUp({
        name: "New",
        email: "new@example.com",
        password: "secret",
      }),
    ).rejects.toThrow("User data unavailable");
    expect(afterSignIn).toHaveBeenCalledTimes(1);
    expect(propertiesService.getScriptProperties().getProperties()).toEqual({});
    // Registration persists even when response data cannot be built; retry with sign-in.
    expect(users.size).toBe(3);
  });

  it("distinguishes restore data failures from invalid, expired and deleted-user sessions", async () => {
    const data = vi.fn(async () => ({ permissions: ["staff:read"] }));
    const { server, auth, client, storage, users, repository, afterSignIn } =
      setup(data);
    const signedUp = await auth.signUp({ name: "Email", ...credentials });
    const calls = data.mock.calls.length;
    data.mockRejectedValue(new Error("User data unavailable"));
    await expect(auth.restoreSession()).rejects.toThrow(
      "User data unavailable",
    );
    expect(storage.get()).toBe(signedUp.token);
    expect(await server.session.get(signedUp.token)).not.toBeNull();
    expect(await client.getSession({ sessionId: "invalid" })).toBeNull();
    expect(data).toHaveBeenCalledTimes(calls + 1);
    users.clear();
    expect(await auth.restoreSession()).toBeNull();
    expect(storage.get()).toBeNull();
    expect(afterSignIn).toHaveBeenCalledOnce();
    const lookups = repository.user.find.mock.calls.length;
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 21 * 60 * 1000);
      expect(await client.getSession({ sessionId: signedUp.token })).toBeNull();
      expect(repository.user.find).toHaveBeenCalledTimes(lookups);
    } finally {
      vi.useRealTimers();
    }
  });
});

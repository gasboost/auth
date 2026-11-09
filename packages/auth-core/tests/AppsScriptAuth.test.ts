import {
  InMemoryCacheService,
  InMemoryContext,
  InMemoryPropertiesService,
  InMemorySession,
  OAuthScope,
  SecurityPolicy,
} from "@gasboost/fake-core";
import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, it, vi } from "vitest";

import type { AfterSignInContext } from "../src/hooks/AuthHooks";
import { AppsScriptAuthRegistration } from "../src/api/AppsScriptAuthRegistration";
import { AppsScriptAuth } from "../src/AppsScriptAuth";
import type { AppsScriptAuthRepository } from "../src/storage/AppsScriptAuthRepository";

function createRepository() {
  return {
    account: {
      findByIdentity: vi.fn().mockResolvedValue(null),
    },
    user: {
      find: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    passwordCredential: {
      findByResetTokenHash: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    },
  } satisfies AppsScriptAuthRepository;
}
function createSession(email = "user@example.com") {
  const context = new InMemoryContext(
    "owner@example.com",
    email,
    {
      type: "WEB_APP",
      executeAs: "USER",
    },
    new SecurityPolicy([OAuthScope.USERINFO_EMAIL]),
    "ja",
    "Asia/Tokyo",
  );

  return new InMemorySession(context);
}

function createRuntime() {
  return {
    utilities: new NodeUtilities(),
    session: createSession(),
    cacheService: new InMemoryCacheService(),
    propertiesService: new InMemoryPropertiesService(),
  };
}

describe("AppsScriptAuth", () => {
  it("公開APIを生成する", () => {
    const auth = new AppsScriptAuth({
      repository: createRepository(),
      runtime: createRuntime(),
      session: {
        storageType: "cache",
      },
    });

    expect(auth.signIn).toBeDefined();
    expect(auth.signUp).toBeDefined();
    expect(auth.signOut).toBeDefined();
    expect(auth.session).toBeDefined();

    expect(auth.signIn.email).toBeTypeOf("function");
    expect(auth.signIn.appsScript).toBeTypeOf("function");

    expect(auth.signUp.email).toBeTypeOf("function");
    expect(auth.signUp.appsScript).toBeTypeOf("function");
  });

  it("emailPasswordが有効なのにpepperが空なら初期化を拒否する", () => {
    expect(
      () =>
        new AppsScriptAuth({
          repository: createRepository(),
          runtime: createRuntime(),
          session: {
            storageType: "cache",
          },
          emailPassword: {
            enabled: true,
            pepper: "",
          },
        }),
    ).toThrow(
      "Pepper is required when email and password authentication is enabled",
    );
  });

  it("emailPasswordが有効でpepperがあれば初期化できる", () => {
    expect(
      () =>
        new AppsScriptAuth({
          repository: createRepository(),
          runtime: createRuntime(),
          session: {
            storageType: "cache",
          },
          emailPassword: {
            enabled: true,
            pepper: "pepper",
          },
        }),
    ).not.toThrow();
  });

  it("emailPassword設定を省略できる", () => {
    expect(
      () =>
        new AppsScriptAuth({
          repository: createRepository(),
          runtime: createRuntime(),
          session: {
            storageType: "cache",
          },
        }),
    ).not.toThrow();
  });

  it("appsScript設定を省略できる", () => {
    expect(
      () =>
        new AppsScriptAuth({
          repository: createRepository(),
          runtime: createRuntime(),
          session: {
            storageType: "cache",
          },
          emailPassword: {
            enabled: false,
            pepper: "",
          },
        }),
    ).not.toThrow();
  });

  it("cache session storageで初期化できる", () => {
    expect(
      () =>
        new AppsScriptAuth({
          repository: createRepository(),
          runtime: createRuntime(),
          session: {
            storageType: "cache",
            expiresIn: 60_000,
          },
        }),
    ).not.toThrow();
  });

  it.each([
    { name: "default", expiresIn: undefined, expectedMs: 20 * 60 * 1000 },
    { name: "explicit", expiresIn: 90_000, expectedMs: 90_000 },
  ])(
    "$name Session TTLをミリ秒で扱い、cache TTLは秒に変換する",
    async ({ expiresIn, expectedMs }) => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2026-11-06T00:00:00.000Z"));

        const repository = createRepository();
        const runtime = createRuntime();
        const cache = runtime.cacheService.getScriptCache();
        vi.spyOn(runtime.cacheService, "getScriptCache").mockReturnValue(cache);
        const put = vi.spyOn(cache, "put");

        const auth = new AppsScriptAuth({
          repository,
          runtime,
          session: { storageType: "cache", expiresIn },
          appsScript: { enabled: true, isSignupEnabled: true },
        });

        const signedUp = await auth.signUp.appsScript({ name: "Staff" });
        expect(
          signedUp.session.expiresAt.getTime() -
            signedUp.session.createdAt.getTime(),
        ).toBe(expectedMs);
        expect(put).toHaveBeenLastCalledWith(
          signedUp.session.id,
          expect.any(String),
          expectedMs / 1000,
        );
        expect(await auth.session.get(signedUp.session.id)).toEqual(
          signedUp.session,
        );

        vi.mocked(repository.account.findByIdentity).mockResolvedValue(
          repository.user.create.mock.calls[0][0].accounts[0],
        );
        vi.mocked(repository.user.find).mockResolvedValue(
          repository.user.create.mock.calls[0][0],
        );

        const signedIn = await auth.signIn.appsScript({});
        expect(
          signedIn.session.expiresAt.getTime() -
            signedIn.session.createdAt.getTime(),
        ).toBe(expectedMs);
        expect(put).toHaveBeenLastCalledWith(
          signedIn.session.id,
          expect.any(String),
          expectedMs / 1000,
        );
        expect(await auth.session.get(signedIn.session.id)).toEqual(
          signedIn.session,
        );
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("properties session storageで初期化できる", () => {
    expect(
      () =>
        new AppsScriptAuth({
          repository: createRepository(),
          runtime: createRuntime(),
          session: {
            storageType: "properties",
            expiresIn: 60_000,
          },
        }),
    ).not.toThrow();
  });

  it("passwordReset設定を省略できる", () => {
    const auth = new AppsScriptAuth({
      repository: createRepository(),
      runtime: createRuntime(),
      session: {
        storageType: "cache",
      },
      emailPassword: {
        enabled: true,
        pepper: "pepper",
      },
    });

    expect(auth.password).toBeUndefined();
  });

  it("emailPassword設定を省略した場合password APIを公開しない", () => {
    const auth = new AppsScriptAuth({
      repository: createRepository(),
      runtime: createRuntime(),
      session: {
        storageType: "cache",
      },
    });

    expect(auth.password).toBeUndefined();
  });

  it("passwordReset設定がある場合password APIを公開する", () => {
    const auth = new AppsScriptAuth({
      repository: createRepository(),
      runtime: createRuntime(),
      session: {
        storageType: "cache",
      },
      emailPassword: {
        enabled: true,
        pepper: "pepper",
        passwordReset: {
          delivery: {
            send: vi.fn(),
          },
        },
      },
    });

    expect(auth.password).toBeDefined();
    expect(auth.password?.forgot).toBeTypeOf("function");
    expect(auth.password?.reset).toBeTypeOf("function");
  });

  describe("registration", () => {
    it("AppsScriptAuthからRegistration APIを利用できる", () => {
      const auth = new AppsScriptAuth({
        repository: createRepository(),
        runtime: createRuntime(),
        session: {
          storageType: "cache",
        },
      });

      expect(auth.registration).toBeInstanceOf(AppsScriptAuthRegistration);

      expect(auth.registration.email).toBeTypeOf("function");
      expect(auth.registration.appsScript).toBeTypeOf("function");
    });
  });

  it("AppsScriptAuth経由でApps Scriptユーザーを登録できる", async () => {
    const repository = createRepository();

    const auth = new AppsScriptAuth({
      repository,
      runtime: createRuntime(),
      session: {
        storageType: "cache",
      },
      appsScript: {
        enabled: true,
        isSignupEnabled: false,
      },
    });

    const user = await auth.registration.appsScript({
      email: "user@example.com",
      name: "Staff",
    });

    expect(user.name).toBe("Staff");
    expect(repository.user.create.mock.calls[0][0].accounts).toHaveLength(1);
    expect(repository.user.create.mock.calls[0][0].accounts[0].userId).toBe(
      user.id,
    );
    expect(
      repository.user.create.mock.calls[0][0].accounts[0].identity.providerName,
    ).toBe("appsScript");
    expect(
      repository.user.create.mock.calls[0][0].accounts[0].identity.accountId,
    ).toBe("user@example.com");
    expect(user).toEqual({ id: user.id, name: user.name });
  });

  it("AppsScriptAuth経由でEmailPasswordユーザーを登録できる", async () => {
    const repository = createRepository();

    const auth = new AppsScriptAuth({
      repository,
      runtime: createRuntime(),
      session: {
        storageType: "cache",
      },
      emailPassword: {
        enabled: true,
        isSignupEnabled: false,
        pepper: "pepper",
      },
    });

    const user = await auth.registration.email({
      name: "Taro",
      email: "taro@example.com",
      password: "temporaryPassword123",
    });

    expect(user.name).toBe("Taro");
    expect(repository.user.create.mock.calls[0][0].accounts).toHaveLength(1);
    expect(
      repository.user.create.mock.calls[0][0].accounts[0].identity.providerName,
    ).toBe("emailPassword");
    expect(
      repository.user.create.mock.calls[0][0].accounts[0].identity.accountId,
    ).toBe("taro@example.com");
    expect(user).toEqual({ id: user.id, name: user.name });
  });
  it.each(["email", "appsScript"] as const)(
    "awaits the shared hook once after %s signup is saved",
    async (provider) => {
      const repository = createRepository();
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      let started!: () => void;
      const entered = new Promise<void>((resolve) => {
        started = resolve;
      });
      const afterSignIn = vi.fn(
        async ({ user, session }: AfterSignInContext) => {
          expect(repository.user.create).toHaveBeenCalledWith(user);
          expect(await auth.session.get(session.id)).not.toBeNull();
          started();
          await pending;
          return { customToken: "custom" };
        },
      );
      const auth = new AppsScriptAuth({
        repository,
        runtime: createRuntime(),
        session: { storageType: "cache" },
        emailPassword: {
          enabled: true,
          isSignupEnabled: true,
          pepper: "pepper",
        },
        appsScript: { enabled: true, isSignupEnabled: true },
        hooks: { afterSignIn },
      });
      let settled = false;
      const result = auth.signUp[provider]({
        name: "Taro",
        email: "user@example.com",
        password: "password",
      });
      void result.then(() => {
        settled = true;
      });
      await entered;
      expect(settled).toBe(false);
      release();
      expect((await result).hooks.customToken).toBe("custom");
      expect(afterSignIn).toHaveBeenCalledOnce();
    },
  );
});

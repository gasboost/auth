import { describe, expect, it, vi } from "vitest";

import { SignIn } from "../../src/api/SignIn";
import type { Authentication } from "../../src/authentication/Authentication";
import { User } from "../../src/domain/User";
import type { AppsScriptSessionStorage } from "../../src/storage/AppsScriptSessionStorage";

describe("SignIn", () => {
  it("認証したUserでSessionを作成して保存する", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T00:00:00.000Z"));

    const user = new User({
      id: "user-1",
      name: "Taro",
      accounts: [],
    });

    const authentication = {
      verify: vi.fn().mockResolvedValue(user),
    } satisfies Authentication<{
      email: string;
      password: string;
    }>;

    const sessionStorage = {
      save: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      cleanupExpired: vi.fn(),
    } satisfies AppsScriptSessionStorage;

    const utilities = {
      getUuid: vi.fn(() => "session-1"),
    } as unknown as GoogleAppsScript.Utilities.Utilities;

    const signIn = new SignIn({
      sessionStorage,
      authentication,
      utilities,
      expiresIn: 1000 * 60 * 20,
    });

    const credential = {
      email: "user@example.com",
      password: "password",
    };

    const result = await signIn.execute(credential);

    expect(authentication.verify).toHaveBeenCalledWith(credential);

    expect(result.user).toBe(user);
    expect(result.session.id).toBe("session-1");
    expect(result.session.userId).toBe("user-1");
    expect(result.session.createdAt).toEqual(
      new Date("2026-09-09T00:00:00.000Z"),
    );
    expect(result.session.expiresAt).toEqual(
      new Date("2026-09-09T00:20:00.000Z"),
    );

    expect(sessionStorage.save).toHaveBeenCalledWith(result.session);

    vi.useRealTimers();
  });

  it("認証に失敗した場合はSessionを保存しない", async () => {
    const authentication = {
      verify: vi.fn().mockRejectedValue(new Error("Authentication failed")),
    } satisfies Authentication<unknown>;

    const sessionStorage = {
      save: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      cleanupExpired: vi.fn(),
    } satisfies AppsScriptSessionStorage;

    const signIn = new SignIn({
      sessionStorage,
      authentication,
      utilities: {
        getUuid: vi.fn(() => "session-1"),
      } as unknown as GoogleAppsScript.Utilities.Utilities,
      expiresIn: 1000,
    });

    await expect(signIn.execute({})).rejects.toThrow("Authentication failed");

    expect(sessionStorage.save).not.toHaveBeenCalled();
  });

  it("Session保存に失敗した場合はそのエラーを伝播する", async () => {
    const user = new User({
      id: "user-1",
      name: "Taro",
      accounts: [],
    });

    const authentication = {
      verify: vi.fn().mockResolvedValue(user),
    } satisfies Authentication<unknown>;

    const sessionStorage = {
      save: vi.fn().mockRejectedValue(new Error("Storage failed")),
      get: vi.fn(),
      delete: vi.fn(),
      cleanupExpired: vi.fn(),
    } satisfies AppsScriptSessionStorage;

    const signIn = new SignIn({
      sessionStorage,
      authentication,
      utilities: {
        getUuid: vi.fn(() => "session-1"),
      } as unknown as GoogleAppsScript.Utilities.Utilities,
      expiresIn: 1000,
    });

    await expect(signIn.execute({})).rejects.toThrow("Storage failed");
  });

  it("認証成功後にafterSignInを実行する", async () => {
    const user = new User({
      id: "user-1",
      name: "Taro",
      accounts: [],
    });

    const authentication = {
      verify: vi.fn().mockResolvedValue(user),
    } satisfies Authentication<unknown>;

    const sessionStorage = {
      save: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      cleanupExpired: vi.fn(),
    } satisfies AppsScriptSessionStorage;

    const afterSignIn = vi.fn(({ user, session }) => ({
      token: `${user.id}:${session.id}`,
    }));

    const signIn = new SignIn({
      sessionStorage,
      authentication,
      utilities: {
        getUuid: vi.fn(() => "session-1"),
      } as unknown as GoogleAppsScript.Utilities.Utilities,
      expiresIn: 1000,
      afterSignIn,
    });

    const result = await signIn.execute({});

    expect(afterSignIn).toHaveBeenCalledWith({
      user,
      session: result.session,
    });

    expect(result.hooks).toEqual({
      token: "user-1:session-1",
    });
  });

  it("認証失敗時はafterSignInを実行しない", async () => {
    const authentication = {
      verify: vi.fn().mockRejectedValue(new Error("Authentication failed")),
    } satisfies Authentication<unknown>;

    const sessionStorage = {
      save: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      cleanupExpired: vi.fn(),
    } satisfies AppsScriptSessionStorage;

    const afterSignIn = vi.fn();

    const signIn = new SignIn({
      sessionStorage,
      authentication,
      utilities: {
        getUuid: vi.fn(() => "session-1"),
      } as unknown as GoogleAppsScript.Utilities.Utilities,
      expiresIn: 1000,
      afterSignIn,
    });

    await expect(signIn.execute({})).rejects.toThrow("Authentication failed");

    expect(afterSignIn).not.toHaveBeenCalled();
  });

  it("afterSignIn失敗時はSessionを削除してエラーを伝播する", async () => {
    const user = new User({
      id: "user-1",
      name: "Taro",
      accounts: [],
    });

    const authentication = {
      verify: vi.fn().mockResolvedValue(user),
    } satisfies Authentication<unknown>;

    const sessionStorage = {
      save: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      cleanupExpired: vi.fn(),
    } satisfies AppsScriptSessionStorage;

    const signIn = new SignIn({
      sessionStorage,
      authentication,
      utilities: {
        getUuid: vi.fn(() => "session-1"),
      } as unknown as GoogleAppsScript.Utilities.Utilities,
      expiresIn: 1000,
      afterSignIn: () => {
        throw new Error("Hook failed");
      },
    });

    await expect(signIn.execute({})).rejects.toThrow("Hook failed");

    expect(sessionStorage.delete).toHaveBeenCalledWith("session-1");
  });

  it("async afterSignInの戻り値を返す", async () => {
    const user = new User({
      id: "user-1",
      name: "Taro",
      accounts: [],
    });

    const authentication = {
      verify: vi.fn().mockResolvedValue(user),
    } satisfies Authentication<unknown>;

    const sessionStorage = {
      save: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      cleanupExpired: vi.fn(),
    } satisfies AppsScriptSessionStorage;

    const signIn = new SignIn({
      sessionStorage,
      authentication,
      utilities: {
        getUuid: vi.fn(() => "session-1"),
      } as unknown as GoogleAppsScript.Utilities.Utilities,
      expiresIn: 1000,
      afterSignIn: async () => ({
        customToken: "firebase-token",
      }),
    });

    const result = await signIn.execute({});

    expect(result.hooks.customToken).toBe("firebase-token");
  });
});

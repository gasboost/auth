import { describe, expect, it, vi } from "vitest";

import { SignUp } from "../../src/api/SignUp";
import { User } from "../../src/domain/User";
import type { Registration } from "../../src/registration/Registration";
import type { AppsScriptSessionStorage } from "../../src/storage/AppsScriptSessionStorage";

describe("SignUp", () => {
  it("登録したUserでSessionを作成して保存する", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T00:00:00.000Z"));

    const user = new User({
      id: "user-1",
      name: "Taro",
      accounts: [],
    });

    const registration = {
      register: vi.fn().mockResolvedValue(user),
    } satisfies Registration<{
      name: string;
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

    const signUp = new SignUp({
      sessionStorage,
      registration,
      utilities,
      expiresIn: 1000 * 60 * 20,
    });

    const input = {
      name: "Taro",
    };

    const result = await signUp.execute(input);

    expect(registration.register).toHaveBeenCalledWith(input);

    expect(result).not.toHaveProperty("hooks");
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

  it("登録に失敗した場合はSessionを保存しない", async () => {
    const registration = {
      register: vi.fn().mockRejectedValue(new Error("Registration failed")),
    } satisfies Registration<unknown>;

    const sessionStorage = {
      save: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      cleanupExpired: vi.fn(),
    } satisfies AppsScriptSessionStorage;

    const signUp = new SignUp({
      sessionStorage,
      registration,
      utilities: {
        getUuid: vi.fn(() => "session-1"),
      } as unknown as GoogleAppsScript.Utilities.Utilities,
      expiresIn: 1000,
    });

    await expect(signUp.execute({})).rejects.toThrow("Registration failed");

    expect(sessionStorage.save).not.toHaveBeenCalled();
  });

  it("Session保存に失敗した場合はそのエラーを伝播する", async () => {
    const user = new User({
      id: "user-1",
      name: "Taro",
      accounts: [],
    });

    const registration = {
      register: vi.fn().mockResolvedValue(user),
    } satisfies Registration<unknown>;

    const sessionStorage = {
      save: vi.fn().mockRejectedValue(new Error("Storage failed")),
      get: vi.fn(),
      delete: vi.fn(),
      cleanupExpired: vi.fn(),
    } satisfies AppsScriptSessionStorage;

    const signUp = new SignUp({
      sessionStorage,
      registration,
      utilities: {
        getUuid: vi.fn(() => "session-1"),
      } as unknown as GoogleAppsScript.Utilities.Utilities,
      expiresIn: 1000,
    });

    await expect(signUp.execute({})).rejects.toThrow("Storage failed");
  });
  it.each([false, true])(
    "preserves hook errors and rolls back only the session (delete fails: %s)",
    async (deleteFails) => {
      const error = new Error("Hook failed");
      const user = new User({ id: "user-1", name: "Taro", accounts: [] });
      const registration = { register: vi.fn().mockResolvedValue(user) };
      const sessionStorage = {
        save: vi.fn(),
        get: vi.fn(),
        cleanupExpired: vi.fn(),
        delete: deleteFails
          ? vi.fn().mockRejectedValue(new Error("Delete failed"))
          : vi.fn(),
      };
      const afterSignIn = vi.fn(async () => {
        throw error;
      });
      const signUp = new SignUp({
        registration,
        sessionStorage,
        afterSignIn,
        expiresIn: 1000,
        utilities: {
          getUuid: () => "session-1",
        } as GoogleAppsScript.Utilities.Utilities,
      });
      await expect(signUp.execute({})).rejects.toBe(error);
      expect(afterSignIn).toHaveBeenCalledOnce();
      expect(afterSignIn).toHaveBeenCalledWith({
        user,
        session: sessionStorage.save.mock.calls[0]![0],
      });
      expect(sessionStorage.delete).toHaveBeenCalledExactlyOnceWith(
        "session-1",
      );
      expect(registration.register).toHaveBeenCalledOnce();
    },
  );
});

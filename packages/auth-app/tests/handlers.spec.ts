import { AppsScriptAuth } from "@gasboost/auth";
import { describe, expect, it, vi } from "vitest";

import { handlers } from "../src/handlers";

type EmailPasswordOptions = ConstructorParameters<
  typeof AppsScriptAuth
>[0]["emailPassword"];

type EnabledEmailPasswordOptions = NonNullable<EmailPasswordOptions> & {
  passwordReset: NonNullable<
    NonNullable<EmailPasswordOptions>["passwordReset"]
  >;
};

function createDisabledAuth(): AppsScriptAuth<undefined> {
  return {
    signIn: {
      email: vi.fn(),
      appsScript: vi.fn(),
    },

    signUp: {
      email: vi.fn(),
      appsScript: vi.fn(),
    },

    session: {
      get: vi.fn(),
    },

    signOut: {
      execute: vi.fn(),
    },

    password: undefined,
  } as unknown as AppsScriptAuth<undefined>;
}

function createEnabledAuth(): {
  auth: AppsScriptAuth<EnabledEmailPasswordOptions>;
  forgot: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
} {
  const forgot = vi.fn().mockResolvedValue(undefined);
  const reset = vi.fn().mockResolvedValue(undefined);

  const auth = {
    signIn: {
      email: vi.fn(),
      appsScript: vi.fn(),
    },

    signUp: {
      email: vi.fn(),
      appsScript: vi.fn(),
    },

    session: {
      get: vi.fn(),
    },

    signOut: {
      execute: vi.fn(),
    },

    password: {
      forgot,
      reset,
    },
  } as unknown as AppsScriptAuth<EnabledEmailPasswordOptions>;

  return {
    auth,
    forgot,
    reset,
  };
}

describe("handlers", () => {
  it("getSessionをobject inputへ変換する", async () => {
    const auth = createDisabledAuth();

    const get = vi.spyOn(auth.session, "get").mockResolvedValue(null);

    const authHandlers = handlers(auth);

    await authHandlers.getSession({
      sessionId: "session-1",
    });

    expect(get).toHaveBeenCalledWith("session-1");
  });

  it("signOutをobject inputへ変換する", async () => {
    const auth = createDisabledAuth();

    const execute = vi
      .spyOn(auth.signOut, "execute")
      .mockResolvedValue(undefined);

    const authHandlers = handlers(auth);

    await authHandlers.signOut({
      sessionId: "session-1",
    });

    expect(execute).toHaveBeenCalledWith("session-1");
  });

  it("signIn handlerをそのまま公開する", () => {
    const auth = createDisabledAuth();

    const authHandlers = handlers(auth);

    expect(authHandlers.signInEmail).toBe(auth.signIn.email);
    expect(authHandlers.signInAppsScript).toBe(auth.signIn.appsScript);
  });

  it("signUp handlerをそのまま公開する", () => {
    const auth = createDisabledAuth();

    const authHandlers = handlers(auth);

    expect(authHandlers.signUpEmail).toBe(auth.signUp.email);
    expect(authHandlers.signUpAppsScript).toBe(auth.signUp.appsScript);
  });

  it("password resetが有効な場合はhandlerを公開する", async () => {
    const { auth, forgot, reset } = createEnabledAuth();

    const authHandlers = handlers(auth);

    await authHandlers.forgotPassword({
      email: "user@example.com",
    });

    await authHandlers.resetPassword({
      token: "token",
      newPassword: "new-password",
    });

    expect(forgot).toHaveBeenCalledWith({
      email: "user@example.com",
    });

    expect(reset).toHaveBeenCalledWith({
      token: "token",
      newPassword: "new-password",
    });
  });

  it("password resetが無効な場合はhandlerを公開しない", () => {
    const auth = createDisabledAuth();

    const authHandlers = handlers(auth);

    expect("forgotPassword" in authHandlers).toBe(false);
    expect("resetPassword" in authHandlers).toBe(false);
  });
});

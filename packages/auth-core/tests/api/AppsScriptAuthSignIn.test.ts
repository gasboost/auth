import {
  InMemoryContext,
  InMemorySession,
  OAuthScope,
  SecurityPolicy,
} from "@gasboost/fake-core";
import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, it, vi } from "vitest";

import { AppsScriptAuthSignIn } from "../../src/api/AppsScriptAuthSignIn";
import { AppsScriptAuthenticationConfig } from "../../src/authentication/AppsScriptAuthentication";
import { EmailPasswordAuthConfig } from "../../src/authentication/EmailPasswordAuthentication";
import { Account } from "../../src/domain/Account";
import { Password } from "../../src/domain/Password";
import { User } from "../../src/domain/User";
import { AppsScriptIdentity } from "../../src/identity/AppsScriptIdentity";
import { EmailPasswordIdentity } from "../../src/identity/EmailPasswordIdentity";
import type { AppsScriptAuthRepository } from "../../src/storage/AppsScriptAuthRepository";
import type { AppsScriptSessionStorage } from "../../src/storage/AppsScriptSessionStorage";

function createSession(email: string) {
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

function createSessionStorage() {
  return {
    save: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    cleanupExpired: vi.fn(),
  } satisfies AppsScriptSessionStorage;
}

function createRepository({
  account = null,
  user = null,
}: {
  account?: Account | null;
  user?: User | null;
} = {}) {
  return {
    account: {
      findByIdentity: vi.fn().mockResolvedValue(account),
    },
    user: {
      find: vi.fn().mockResolvedValue(user),
      create: vi.fn(),
    },
  } satisfies AppsScriptAuthRepository;
}

describe("AppsScriptAuthSignIn", () => {
  it("emailPasswordが有効な場合はemailでsign inできる", async () => {
    const utilities = new NodeUtilities();
    const pepper = "pepper";
    const iterations = 3;
    const accountId = "account-1";

    const hashedPassword = await new Password(
      "password",
      utilities,
      pepper,
      iterations,
    ).hash(accountId);

    const account = new Account({
      id: accountId,
      userId: "user-1",
      identity: new EmailPasswordIdentity({
        accountId: "user@example.com",
        password: hashedPassword,
      }),
    });

    const user = new User({
      id: "user-1",
      name: "Taro",
      accounts: [account],
    });

    const repository = createRepository({
      account,
      user,
    });

    const sessionStorage = createSessionStorage();

    const signIn = new AppsScriptAuthSignIn({
      sessionStorage,
      repository,
      emailPassword: new EmailPasswordAuthConfig({
        enabled: true,
        pepper,
        iterations,
        isSignupEnabled: true,
      }),
      appsScript: new AppsScriptAuthenticationConfig({
        enabled: false,
      }),
      utilities,
      session: createSession(""),
      expiresIn: 1000,
    });

    const result = await signIn.email({
      email: "user@example.com",
      password: "password",
    });

    expect(result.user).toBe(user);
    expect(result.session.userId).toBe("user-1");
    expect(sessionStorage.save).toHaveBeenCalledWith(result.session);
  });

  it("emailPasswordが無効な場合はemail sign inを拒否する", async () => {
    const signIn = new AppsScriptAuthSignIn({
      sessionStorage: createSessionStorage(),
      repository: createRepository(),
      emailPassword: new EmailPasswordAuthConfig({
        enabled: false,
        pepper: "pepper",
        isSignupEnabled: false,
      }),
      appsScript: new AppsScriptAuthenticationConfig({
        enabled: false,
      }),
      utilities: new NodeUtilities(),
      session: createSession(""),
      expiresIn: 1000,
    });

    await expect(
      signIn.email({
        email: "user@example.com",
        password: "password",
      }),
    ).rejects.toThrow("Email and password authentication is disabled");
  });

  it("appsScriptが有効な場合はActiveUserでsign inできる", async () => {
    const account = new Account({
      id: "account-1",
      userId: "user-1",
      identity: new AppsScriptIdentity({
        googleAccountAddress: "user@example.com",
      }),
    });

    const user = new User({
      id: "user-1",
      name: "Taro",
      accounts: [account],
    });

    const repository = createRepository({
      account,
      user,
    });

    const sessionStorage = createSessionStorage();

    const signIn = new AppsScriptAuthSignIn({
      sessionStorage,
      repository,
      emailPassword: new EmailPasswordAuthConfig({
        enabled: false,
        pepper: "pepper",
        isSignupEnabled: false,
      }),
      appsScript: new AppsScriptAuthenticationConfig({
        enabled: true,
      }),
      utilities: new NodeUtilities(),
      session: createSession("user@example.com"),
      expiresIn: 1000,
    });

    const result = await signIn.appsScript({});

    expect(result.user).toBe(user);
    expect(result.session.userId).toBe("user-1");
    expect(sessionStorage.save).toHaveBeenCalledWith(result.session);
  });

  it("appsScriptが無効な場合はApps Script sign inを拒否する", async () => {
    const signIn = new AppsScriptAuthSignIn({
      sessionStorage: createSessionStorage(),
      repository: createRepository(),
      emailPassword: new EmailPasswordAuthConfig({
        enabled: false,
        pepper: "pepper",
        isSignupEnabled: false,
      }),
      appsScript: new AppsScriptAuthenticationConfig({
        enabled: false,
      }),
      utilities: new NodeUtilities(),
      session: createSession("user@example.com"),
      expiresIn: 1000,
    });

    await expect(signIn.appsScript({})).rejects.toThrow(
      "Apps Script authentication is disabled",
    );
  });
});

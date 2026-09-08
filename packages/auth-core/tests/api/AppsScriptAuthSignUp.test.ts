import {
  InMemoryContext,
  InMemorySession,
  OAuthScope,
  SecurityPolicy,
} from "@gasboost/fake-core";
import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, it, vi } from "vitest";

import { AppsScriptAuthSignUp } from "../../src/api/AppsScriptAuthSignUp";
import { AppsScriptAuthenticationConfig } from "../../src/authentication/AppsScriptAuthentication";
import { EmailPasswordAuthConfig } from "../../src/authentication/EmailPasswordAuthentication";
import { AppsScriptIdentity } from "../../src/identity/AppsScriptIdentity";
import { EmailPasswordIdentity } from "../../src/identity/EmailPasswordIdentity";
import type { AppsScriptAuthRepository } from "../../src/storage/AppsScriptAuthRepository";
import type { AppsScriptSessionStorage } from "../../src/storage/AppsScriptSessionStorage";

function createRepository(): AppsScriptAuthRepository {
  return {
    account: {
      findByIdentity: vi.fn(),
    },
    user: {
      find: vi.fn(),
      create: vi.fn(),
    },
  };
}

function createSessionStorage(): AppsScriptSessionStorage {
  return {
    save: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    cleanupExpired: vi.fn(),
  };
}

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

describe("AppsScriptAuthSignUp", () => {
  it("emailPassword signupが有効な場合はユーザーを登録してセッションを返す", async () => {
    const repository = createRepository();
    const sessionStorage = createSessionStorage();
    const utilities = new NodeUtilities();

    vi.mocked(repository.account.findByIdentity).mockResolvedValue(null);

    const signUp = new AppsScriptAuthSignUp({
      sessionStorage,
      repository,
      emailPassword: new EmailPasswordAuthConfig({
        enabled: true,
        isSignupEnabled: true,
        pepper: "pepper",
      }),
      appsScript: new AppsScriptAuthenticationConfig({
        enabled: false,
      }),
      utilities,
      session: createSession(""),
      expiresIn: 1000,
    });

    const result = await signUp.email({
      name: "User",
      email: "user@example.com",
      password: "password",
    });

    expect(result.user.name).toBe("User");
    expect(result.user.accounts).toHaveLength(1);

    const account = result.user.accounts[0];

    expect(account.userId).toBe(result.user.id);
    expect(account.identity).toBeInstanceOf(EmailPasswordIdentity);
    expect(account.identity.accountId).toBe("user@example.com");

    expect(result.session.userId).toBe(result.user.id);
    expect(
      result.session.expiresAt.getTime() - result.session.createdAt.getTime(),
    ).toBe(1000);

    expect(repository.user.create).toHaveBeenCalledWith(result.user);
    expect(sessionStorage.save).toHaveBeenCalledWith(result.session);
  });

  it("emailPassword認証が無効な場合はsignupを拒否する", async () => {
    const repository = createRepository();
    const sessionStorage = createSessionStorage();

    const signUp = new AppsScriptAuthSignUp({
      sessionStorage,
      repository,
      emailPassword: new EmailPasswordAuthConfig({
        enabled: false,
        isSignupEnabled: true,
        pepper: "pepper",
      }),
      appsScript: new AppsScriptAuthenticationConfig({
        enabled: false,
      }),
      utilities: new NodeUtilities(),
      session: createSession(""),
      expiresIn: 1000,
    });

    await expect(
      signUp.email({
        name: "User",
        email: "user@example.com",
        password: "password",
      }),
    ).rejects.toThrow("Email and password authentication is disabled");

    expect(repository.user.create).not.toHaveBeenCalled();
    expect(sessionStorage.save).not.toHaveBeenCalled();
  });

  it("emailPassword signupが無効な場合はsignupを拒否する", async () => {
    const repository = createRepository();
    const sessionStorage = createSessionStorage();

    const signUp = new AppsScriptAuthSignUp({
      sessionStorage,
      repository,
      emailPassword: new EmailPasswordAuthConfig({
        enabled: true,
        isSignupEnabled: false,
        pepper: "pepper",
      }),
      appsScript: new AppsScriptAuthenticationConfig({
        enabled: false,
      }),
      utilities: new NodeUtilities(),
      session: createSession(""),
      expiresIn: 1000,
    });

    await expect(
      signUp.email({
        name: "User",
        email: "user@example.com",
        password: "password",
      }),
    ).rejects.toThrow("Email and password signup is disabled");

    expect(repository.user.create).not.toHaveBeenCalled();
    expect(sessionStorage.save).not.toHaveBeenCalled();
  });

  it("Apps Script signupが有効な場合はActive Userを登録してセッションを返す", async () => {
    const repository = createRepository();
    const sessionStorage = createSessionStorage();

    vi.mocked(repository.account.findByIdentity).mockResolvedValue(null);

    const signUp = new AppsScriptAuthSignUp({
      sessionStorage,
      repository,
      emailPassword: new EmailPasswordAuthConfig({
        enabled: false,
        isSignupEnabled: false,
        pepper: "pepper",
      }),
      appsScript: new AppsScriptAuthenticationConfig({
        enabled: true,
        isSignupEnabled: true,
      }),
      utilities: new NodeUtilities(),
      session: createSession("user@example.com"),
      expiresIn: 1000,
    });

    const result = await signUp.appsScript({
      name: "User",
    });

    expect(result.user.name).toBe("User");
    expect(result.user.accounts).toHaveLength(1);

    const account = result.user.accounts[0];

    expect(account.userId).toBe(result.user.id);
    expect(account.identity).toBeInstanceOf(AppsScriptIdentity);
    expect(account.identity.accountId).toBe("user@example.com");

    expect(result.session.userId).toBe(result.user.id);

    expect(repository.user.create).toHaveBeenCalledWith(result.user);
    expect(sessionStorage.save).toHaveBeenCalledWith(result.session);
  });

  it("Apps Script認証が無効な場合はsignupを拒否する", async () => {
    const repository = createRepository();
    const sessionStorage = createSessionStorage();

    const signUp = new AppsScriptAuthSignUp({
      sessionStorage,
      repository,
      emailPassword: new EmailPasswordAuthConfig({
        enabled: false,
        isSignupEnabled: false,
        pepper: "pepper",
      }),
      appsScript: new AppsScriptAuthenticationConfig({
        enabled: false,
        isSignupEnabled: true,
      }),
      utilities: new NodeUtilities(),
      session: createSession("user@example.com"),
      expiresIn: 1000,
    });

    await expect(
      signUp.appsScript({
        name: "User",
      }),
    ).rejects.toThrow("Apps Script authentication is disabled");

    expect(repository.user.create).not.toHaveBeenCalled();
    expect(sessionStorage.save).not.toHaveBeenCalled();
  });

  it("Apps Script signupが無効な場合はsignupを拒否する", async () => {
    const repository = createRepository();
    const sessionStorage = createSessionStorage();

    const signUp = new AppsScriptAuthSignUp({
      sessionStorage,
      repository,
      emailPassword: new EmailPasswordAuthConfig({
        enabled: false,
        isSignupEnabled: false,
        pepper: "pepper",
      }),
      appsScript: new AppsScriptAuthenticationConfig({
        enabled: true,
        isSignupEnabled: false,
      }),
      utilities: new NodeUtilities(),
      session: createSession("user@example.com"),
      expiresIn: 1000,
    });

    await expect(
      signUp.appsScript({
        name: "User",
      }),
    ).rejects.toThrow("Apps Script signup is disabled");

    expect(repository.user.create).not.toHaveBeenCalled();
    expect(sessionStorage.save).not.toHaveBeenCalled();
  });
});

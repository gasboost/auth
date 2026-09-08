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
});

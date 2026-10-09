import {
  InMemoryContext,
  InMemorySession,
  OAuthScope,
  SecurityPolicy,
} from "@gasboost/fake-core";
import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, it, vi } from "vitest";

import { AppsScriptAuthRegistration } from "../../src/api/AppsScriptAuthRegistration";
import { AppsScriptAuthenticationConfig } from "../../src/authentication/AppsScriptAuthentication";
import { EmailPasswordAuthConfig } from "../../src/authentication/EmailPasswordAuthentication";
import { authPattern } from "../../src/AuthPattern";
import { User } from "../../src/domain/User";
import { AppsScriptIdentity } from "../../src/identity/AppsScriptIdentity";
import { EmailPasswordIdentity } from "../../src/identity/EmailPasswordIdentity";
import type { AppsScriptAuthRepository } from "../../src/storage/AppsScriptAuthRepository";

function createRepository() {
  return {
    account: {
      findByIdentity: vi.fn().mockResolvedValue(null),
    },
    user: {
      find: vi.fn().mockResolvedValue(null),
      create: vi.fn(async (user: User) => user),
    },
    passwordCredential: {
      findByResetTokenHash: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    },
  } satisfies AppsScriptAuthRepository;
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

function createRegistration({
  repository = createRepository(),
  emailPassword = new EmailPasswordAuthConfig({
    enabled: true,
    isSignupEnabled: false,
    pepper: "pepper",
  }),
  appsScript = new AppsScriptAuthenticationConfig({
    enabled: true,
    isSignupEnabled: false,
  }),
  activeUserEmail = "user@example.com",
}: {
  repository?: ReturnType<typeof createRepository>;
  emailPassword?: EmailPasswordAuthConfig;
  appsScript?: AppsScriptAuthenticationConfig;
  activeUserEmail?: string;
} = {}) {
  return new AppsScriptAuthRegistration({
    repository,
    emailPassword,
    appsScript,
    utilities: new NodeUtilities(),
    session: createSession(activeUserEmail),
  });
}

describe("AppsScriptAuthRegistration", () => {
  describe("email()", () => {
    const input = {
      name: "Taro",
      email: "user@example.com",
      password: "password123",
    };

    it("UserとEmailPasswordAccountを作成し、Userを返す", async () => {
      const repository = createRepository();
      const registration = createRegistration({ repository });

      const user = await registration.email(input);

      expect(user).toBeInstanceOf(User);
      expect(user.name).toBe("Taro");
      expect(user.accounts).toHaveLength(1);

      const account = user.accounts[0];

      expect(account.userId).toBe(user.id);
      expect(account.identity).toBeInstanceOf(EmailPasswordIdentity);
      expect(account.identity.accountId).toBe(input.email);

      expect(repository.account.findByIdentity).toHaveBeenCalledWith(
        authPattern.emailPassword,
        input.email,
      );

      expect(repository.user.create).toHaveBeenCalledWith(user);
    });

    it("isSignupEnabled=falseでも登録できる", async () => {
      const registration = createRegistration({
        emailPassword: new EmailPasswordAuthConfig({
          enabled: true,
          isSignupEnabled: false,
          pepper: "pepper",
        }),
      });

      await expect(registration.email(input)).resolves.toBeInstanceOf(User);
    });

    it("認証方式がdisabledの場合は登録を拒否する", async () => {
      const repository = createRepository();

      const registration = createRegistration({
        repository,
        emailPassword: new EmailPasswordAuthConfig({
          enabled: false,
          pepper: "pepper",
        }),
      });

      await expect(registration.email(input)).rejects.toThrow(
        "Email and password authentication is disabled",
      );

      expect(repository.user.create).not.toHaveBeenCalled();
    });

    it("認証方式が未設定の場合は登録を拒否する", async () => {
      const repository = createRepository();

      const registration = new AppsScriptAuthRegistration({
        repository,
        emailPassword: undefined,
        appsScript: new AppsScriptAuthenticationConfig({
          enabled: true,
        }),
        utilities: new NodeUtilities(),
        session: createSession("user@example.com"),
      });

      await expect(registration.email(input)).rejects.toThrow();

      expect(repository.user.create).not.toHaveBeenCalled();
    });

    it("既存Accountがある場合は登録を拒否する", async () => {
      const repository = createRepository();

      vi.mocked(repository.account.findByIdentity).mockResolvedValue({
        id: "existing-account",
        userId: "existing-user",
        identity: {
          providerName: authPattern.emailPassword,
          accountId: input.email,
        } as EmailPasswordIdentity,
      });

      const registration = createRegistration({ repository });

      await expect(registration.email(input)).rejects.toThrow(
        "Account already registered",
      );

      expect(repository.user.create).not.toHaveBeenCalled();
    });

    it("Repositoryの保存エラーを伝播する", async () => {
      const repository = createRepository();

      repository.user.create.mockRejectedValue(new Error("Repository failure"));

      const registration = createRegistration({ repository });

      await expect(registration.email(input)).rejects.toThrow(
        "Repository failure",
      );
    });
  });

  describe("appsScript()", () => {
    it("ActiveUserからUserとAccountを作成する", async () => {
      const repository = createRepository();

      const registration = createRegistration({
        repository,
        activeUserEmail: "staff@example.com",
      });

      const user = await registration.appsScript({
        name: "Staff",
      });

      expect(user).toBeInstanceOf(User);
      expect(user.name).toBe("Staff");
      expect(user.accounts).toHaveLength(1);

      const account = user.accounts[0];

      expect(account.userId).toBe(user.id);
      expect(account.identity).toBeInstanceOf(AppsScriptIdentity);
      expect(account.identity.accountId).toBe("staff@example.com");

      expect(repository.account.findByIdentity).toHaveBeenCalledWith(
        authPattern.appsScript,
        "staff@example.com",
      );

      expect(repository.user.create).toHaveBeenCalledWith(user);
    });

    it("isSignupEnabled=falseでも登録できる", async () => {
      const registration = createRegistration({
        appsScript: new AppsScriptAuthenticationConfig({
          enabled: true,
          isSignupEnabled: false,
        }),
      });

      await expect(
        registration.appsScript({ name: "Staff" }),
      ).resolves.toBeInstanceOf(User);
    });

    it("認証方式がdisabledの場合は登録を拒否する", async () => {
      const repository = createRepository();

      const registration = createRegistration({
        repository,
        appsScript: new AppsScriptAuthenticationConfig({
          enabled: false,
        }),
      });

      await expect(registration.appsScript({ name: "Staff" })).rejects.toThrow(
        "Apps Script authentication is disabled",
      );

      expect(repository.user.create).not.toHaveBeenCalled();
    });

    it("認証方式が未設定の場合は登録を拒否する", async () => {
      const repository = createRepository();

      const registration = new AppsScriptAuthRegistration({
        repository,
        emailPassword: new EmailPasswordAuthConfig({
          enabled: true,
          pepper: "pepper",
        }),
        appsScript: undefined,
        utilities: new NodeUtilities(),
        session: createSession("user@example.com"),
      });

      await expect(
        registration.appsScript({ name: "Staff" }),
      ).rejects.toThrow();

      expect(repository.user.create).not.toHaveBeenCalled();
    });

    it("ActiveUserのメールが空なら登録を拒否する", async () => {
      const repository = createRepository();

      const registration = createRegistration({
        repository,
        activeUserEmail: "",
      });

      await expect(registration.appsScript({ name: "Staff" })).rejects.toThrow(
        "No active user found",
      );

      expect(repository.user.create).not.toHaveBeenCalled();
    });

    it("既存Accountがある場合は登録を拒否する", async () => {
      const repository = createRepository();

      vi.mocked(repository.account.findByIdentity).mockResolvedValue({
        id: "existing-account",
        userId: "existing-user",
        identity: {
          providerName: authPattern.appsScript,
          accountId: "staff@example.com",
        } as AppsScriptIdentity,
      });

      const registration = createRegistration({
        repository,
        activeUserEmail: "staff@example.com",
      });

      await expect(registration.appsScript({ name: "Staff" })).rejects.toThrow(
        "Account already registered",
      );

      expect(repository.user.create).not.toHaveBeenCalled();
    });
  });
});

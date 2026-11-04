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
      save: vi.fn(async (user: User) => user),
    },
    passwordCredential: {
      findByResetTokenHash: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    },
  } satisfies AppsScriptAuthRepository;
}

function createSession(email: string, executeAs: "OWNER" | "USER" = "USER") {
  const context = new InMemoryContext(
    "owner@example.com",
    email,
    {
      type: "WEB_APP",
      executeAs,
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
  executeAs = "USER",
}: {
  repository?: ReturnType<typeof createRepository>;
  emailPassword?: EmailPasswordAuthConfig;
  appsScript?: AppsScriptAuthenticationConfig;
  activeUserEmail?: string;
  executeAs?: "OWNER" | "USER";
} = {}) {
  return new AppsScriptAuthRegistration({
    repository,
    emailPassword,
    appsScript,
    utilities: new NodeUtilities(),
    session: createSession(activeUserEmail, executeAs),
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

describe("registration.ensure", () => {
  const input = {
    id: "bootstrap-user",
    name: "Admin",
    email: "user@example.com",
    password: "random-temporary-secret",
  };
  it.each([
    [true, false, 1],
    [false, true, 1],
    [true, true, 2],
  ])("enabled email=%s GAS=%s", async (email, gas, count) => {
    const repository = createRepository();
    const registration = createRegistration({
      repository,
      emailPassword: new EmailPasswordAuthConfig({
        enabled: !!email,
        pepper: "pepper",
        iterations: 1,
      }),
      appsScript: new AppsScriptAuthenticationConfig({ enabled: !!gas }),
    });
    const user = await registration.ensure(input);
    expect(user.id).toBe(input.id);
    expect(user.accounts).toHaveLength(count as number);
    expect(user.accounts.every((account) => account.userId === input.id)).toBe(
      true,
    );
    expect(new Set(user.accounts.map((account) => account.id)).size).toBe(
      count,
    );
    expect(repository.user.create).not.toHaveBeenCalled();
    repository.user.find.mockResolvedValue(user);
    repository.account.findByIdentity.mockImplementation(async (provider) =>
      user.account(provider),
    );
    const retried = await registration.ensure({
      ...input,
      password: "different",
    });
    expect(retried.accounts).toEqual(user.accounts);
  });
  it("repairs missing accounts with stable IDs after a partial write", async () => {
    const repository = createRepository();
    const registration = createRegistration({ repository });
    const user = await registration.ensure(input);
    repository.user.find.mockResolvedValue(
      new User({ ...user, accounts: user.accounts.slice(0, 1) }),
    );
    const retried = await registration.ensure(input);
    expect(retried.accounts.map((account) => account.id)).toEqual(
      user.accounts.map((account) => account.id),
    );
    expect(retried.accounts[0]).toBe(user.accounts[0]);
  });
  it("rejects disabled methods", async () => {
    const repository = createRepository();
    const registration = createRegistration({
      repository,
      emailPassword: new EmailPasswordAuthConfig({
        enabled: false,
        pepper: "",
      }),
      appsScript: new AppsScriptAuthenticationConfig({ enabled: false }),
    });
    await expect(registration.ensure(input)).rejects.toThrow(
      "No authentication method",
    );
    expect(repository.user.save).not.toHaveBeenCalled();
  });
  it("rejects an identity belonging to another user", async () => {
    const repository = createRepository();
    const registration = createRegistration({ repository });
    const user = await registration.ensure(input);
    repository.account.findByIdentity.mockResolvedValue({
      ...user.accounts[0],
      userId: "other",
    });
    repository.user.save.mockClear();
    await expect(registration.ensure(input)).rejects.toThrow("another user");
    expect(repository.user.save).not.toHaveBeenCalled();
  });
  it("requires matching active user for GAS, and repository save support", async () => {
    await expect(
      createRegistration({ activeUserEmail: "" }).ensure(input),
    ).rejects.toThrow("Active user");
    const repository = createRepository();
    const registration = createRegistration({ repository });
    delete (repository.user as { save?: unknown }).save;
    await expect(registration.ensure(input)).rejects.toThrow(
      "idempotent user.save",
    );
  });
});

describe("registration.ensureEffectiveUser", () => {
  const input = {
    id: "owner",
    name: "Admin",
    email: "owner@example.com",
    password: "temporary-secret",
  };
  it.each([
    [true, false, 1],
    [false, true, 1],
    [true, true, 2],
  ])(
    "provisions the deployment owner with empty ActiveUser (%s, %s)",
    async (email, gas, count) => {
      const repository = createRepository();
      const registration = createRegistration({
        repository,
        activeUserEmail: "",
        executeAs: "OWNER",
        emailPassword: new EmailPasswordAuthConfig({
          enabled: !!email,
          pepper: "pepper",
          iterations: 1,
        }),
        appsScript: new AppsScriptAuthenticationConfig({ enabled: !!gas }),
      });
      const user = await registration.ensureEffectiveUser(input);
      expect(user.accounts).toHaveLength(count as number);
      expect(
        user.accounts.every(
          (account) =>
            account.userId === input.id &&
            account.identity.accountId === input.email,
        ),
      ).toBe(true);
      repository.user.find.mockResolvedValue(user);
      repository.account.findByIdentity.mockImplementation(async (provider) =>
        user.account(provider),
      );
      expect((await registration.ensureEffectiveUser(input)).accounts).toEqual(
        user.accounts,
      );
    },
  );
  it("rejects another recipient before any repository access, including email-only auth", async () => {
    const repository = createRepository();
    const registration = createRegistration({
      repository,
      appsScript: new AppsScriptAuthenticationConfig({ enabled: false }),
    });
    await expect(
      registration.ensureEffectiveUser({
        ...input,
        email: "other@example.com",
      }),
    ).rejects.toThrow("Effective user");
    expect(repository.user.find).not.toHaveBeenCalled();
    expect(repository.account.findByIdentity).not.toHaveBeenCalled();
    expect(repository.user.save).not.toHaveBeenCalled();
  });
  it("keeps the existing ActiveUser policy on ensure()", async () => {
    const registration = createRegistration({ activeUserEmail: "" });
    await expect(registration.ensure(input)).rejects.toThrow("Active user");
  });
});

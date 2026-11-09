import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, it, vi } from "vitest";
import {
  AppsScriptAuthAccount,
  type AddAccountInput,
} from "../../src/api/AppsScriptAuthAccount";
import { AppsScriptAuthenticationConfig } from "../../src/authentication/AppsScriptAuthentication";
import { EmailPasswordAuthConfig } from "../../src/authentication/EmailPasswordAuthentication";
import { Account } from "../../src/domain/Account";
import { Password } from "../../src/domain/Password";
import { User } from "../../src/domain/User";
import { AppsScriptIdentity } from "../../src/identity/AppsScriptIdentity";
import { EmailPasswordIdentity } from "../../src/identity/EmailPasswordIdentity";
import type { AppsScriptAuthRepository } from "../../src/storage/AppsScriptAuthRepository";

function setup(enabled = true) {
  const user = new User({ id: "user", name: "Existing", accounts: [] });
  const repository = {
    account: {
      findByIdentity: vi
        .fn<(provider: string, email: string) => Promise<Account | null>>()
        .mockResolvedValue(null),
      create: vi.fn(async (account: Account) => account),
    },
    user: { find: vi.fn().mockResolvedValue(user), create: vi.fn() },
    passwordCredential: { findByResetTokenHash: vi.fn(), save: vi.fn() },
  } satisfies AppsScriptAuthRepository;
  const utilities = new NodeUtilities();
  const config = {
    repository,
    utilities,
    emailPassword: new EmailPasswordAuthConfig({
      enabled,
      isSignupEnabled: false,
      pepper: "pepper",
      iterations: 1,
    }),
    appsScript: new AppsScriptAuthenticationConfig({
      enabled,
      isSignupEnabled: false,
    }),
  };
  return {
    repository,
    user,
    utilities,
    config,
    api: new AppsScriptAuthAccount(config),
  };
}
const inputs: AddAccountInput[] = [
  { provider: "appsScript", email: "admin@example.com" },
  { provider: "emailPassword", email: "admin@example.com", password: "secret" },
];
describe("account.add", () => {
  it.each(inputs)(
    "adds $provider without creating a User or requiring signup",
    async (input) => {
      const { api, repository, user, utilities } = setup();
      const account = await api.add(user.id, input);
      expect(account.userId).toBe(user.id);
      expect(account.providerName).toBe(input.provider);
      expect(account.accountId).toBe(input.email);
      const stored = repository.account.create.mock.calls[0][0];
      expect(stored).toBeInstanceOf(Account);
      expect(stored.id).toBe(account.id);
      expect(account).not.toHaveProperty("identity");
      expect(repository.user.create).not.toHaveBeenCalled();
      expect(user.accounts).toEqual([]);
      if (stored.identity instanceof EmailPasswordIdentity) {
        expect(stored.identity.password.value).not.toBe("secret");
        expect(
          await stored.identity.password.verify(
            new Password("secret", utilities, "pepper", 1),
            account.id,
          ),
        ).toBe(true);
      }
    },
  );
  it.each(inputs)(
    "rejects disabled $provider before repository access",
    async (input) => {
      const { api, repository } = setup(false);
      await expect(api.add("user", input)).rejects.toThrow("disabled");
      expect(repository.user.find).not.toHaveBeenCalled();
      expect(repository.account.create).not.toHaveBeenCalled();
    },
  );
  it("rejects an unconfigured provider", async () => {
    const { config, repository } = setup();
    const api = new AppsScriptAuthAccount({
      ...config,
      appsScript: undefined,
      emailPassword: undefined,
    });
    for (const input of inputs)
      await expect(api.add("user", input)).rejects.toThrow("disabled");
    expect(repository.account.create).not.toHaveBeenCalled();
  });
  it("rejects a missing or mismatched user", async () => {
    const { api, repository } = setup();
    repository.user.find.mockResolvedValueOnce(null);
    await expect(api.add("missing", inputs[0])).rejects.toThrow(
      "User not found",
    );
    await expect(api.add("other", inputs[0])).rejects.toThrow("User not found");
    expect(repository.account.create).not.toHaveBeenCalled();
  });
  it.each(["user", "other"])(
    "rejects identity already owned by %s",
    async (owner) => {
      const { api, repository } = setup();
      repository.account.findByIdentity.mockResolvedValue(
        new Account({
          id: "existing",
          userId: owner,
          identity: new AppsScriptIdentity({
            googleAccountAddress: inputs[0].email,
          }),
        }),
      );
      await expect(api.add("user", inputs[0])).rejects.toThrow(
        "Account already registered",
      );
      expect(repository.account.create).not.toHaveBeenCalled();
    },
  );
  it("rejects a second account of the same provider with another email", async () => {
    const { api, repository, user } = setup();
    user.accounts.push(
      new Account({
        id: "existing",
        userId: user.id,
        identity: new AppsScriptIdentity({
          googleAccountAddress: "old@example.com",
        }),
      }),
    );
    await expect(api.add(user.id, inputs[0])).rejects.toThrow(
      "already has an account",
    );
    expect(repository.account.create).not.toHaveBeenCalled();
  });
  it("requires repository support only when account.add is called", async () => {
    const { config, repository } = setup();
    const api = new AppsScriptAuthAccount({
      ...config,
      repository: {
        ...repository,
        account: { findByIdentity: repository.account.findByIdentity },
      },
    });
    await expect(api.add("user", inputs[0])).rejects.toThrow("account.create");
    expect(repository.user.find).not.toHaveBeenCalled();
  });
  it.each(["", " "])("rejects empty input %j before writes", async (value) => {
    const { api, repository } = setup();
    await expect(api.add(value, inputs[0])).rejects.toThrow("required");
    await expect(
      api.add("user", { ...inputs[0], email: value }),
    ).rejects.toThrow("required");
    expect(repository.account.create).not.toHaveBeenCalled();
  });
  it("propagates persistence failures", async () => {
    const { api, repository } = setup();
    repository.account.create.mockRejectedValue(new Error("write failed"));
    await expect(api.add("user", inputs[0])).rejects.toThrow("write failed");
  });
});

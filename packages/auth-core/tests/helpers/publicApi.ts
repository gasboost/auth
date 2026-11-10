import {
  InMemoryCacheService,
  InMemoryContext,
  InMemoryPropertiesService,
  InMemorySession,
  OAuthScope,
  SecurityPolicy,
} from "@gasboost/fake-core";
import { NodeUtilities } from "@gasboost/fake-node";
import type { AfterSignInContext } from "../../src/hooks/AuthHooks";
import { AppsScriptAuth } from "../../src/AppsScriptAuth";
import { Account } from "../../src/domain/Account";
import { User } from "../../src/domain/User";
import type { AppsScriptAuthRepository } from "../../src/storage/AppsScriptAuthRepository";

export function publicApiFixture(withHooks = true, withData = true) {
  const users = new Map<string, User>();
  const accounts: Account[] = [];
  const repository = {
    user: {
      find: async (id: string) => users.get(id) ?? null,
      create: async (user: User) => {
        Object.assign(user, { futureSecret: "private-user-field" });
        users.set(user.id, user);
        accounts.push(...user.accounts);
        return user;
      },
    },
    account: {
      findByIdentity: async (provider: string, id: string) =>
        accounts.find(
          (account) =>
            account.identity.providerName === provider &&
            account.identity.accountId === id,
        ) ?? null,
      create: async (account: Account) => {
        Object.assign(account, { futureSecret: "private-account-field" });
        accounts.push(account);
        users.get(account.userId)!.accounts.push(account);
        return account;
      },
    },
    passwordCredential: {
      findByResetTokenHash: async () => null,
      save: async () => {},
    },
  } satisfies AppsScriptAuthRepository;
  const hookUsers: User[] = [];
  const config = {
    repository,
    runtime: {
      utilities: new NodeUtilities(),
      cacheService: new InMemoryCacheService(),
      propertiesService: new InMemoryPropertiesService(),
      session: new InMemorySession(
        new InMemoryContext(
          "owner@example.com",
          "user@example.com",
          { type: "WEB_APP", executeAs: "USER" },
          new SecurityPolicy([OAuthScope.USERINFO_EMAIL]),
          "ja",
          "Asia/Tokyo",
        ),
      ),
    },
    session: { storageType: "cache" },
    emailPassword: {
      enabled: true,
      isSignupEnabled: true,
      pepper: "pepper",
      iterations: 1,
    },
    appsScript: { enabled: true, isSignupEnabled: true },
    ...(withData
      ? {
          user: {
            data: ({ user }: { user: User }) => ({
              permissions: ["read"],
              employeeId: user.id,
            }),
          },
        }
      : {}),
    ...(withHooks
      ? {
          hooks: {
            afterSignIn: ({ user, session }: AfterSignInContext) => {
              hookUsers.push(user);
              Object.assign(user, { hookSecret: "private-hook-field" });
              Object.assign(session, { futureSecret: "private-session-field" });
              return { customToken: "public-token" };
            },
          },
        }
      : {}),
  } as const;
  const auth = new AppsScriptAuth(config);
  return { auth, config, users, accounts, hookUsers };
}

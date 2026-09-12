import { AppsScriptAuth } from "../../src/AppsScriptAuth";
import type { EmailPasswordAuthOptions } from "../../src/authentication/EmailPasswordAuthentication";
import type { AppsScriptAuthRepository } from "../../src/storage/AppsScriptAuthRepository";

declare const repository: AppsScriptAuthRepository;
declare const utilities: GoogleAppsScript.Utilities.Utilities;
declare const session: GoogleAppsScript.Base.Session;
declare const cacheService: GoogleAppsScript.Cache.CacheService;
declare const propertiesService: GoogleAppsScript.Properties.PropertiesService;

type HookResult = {
  readonly customToken: string;
};

const auth = new AppsScriptAuth<EmailPasswordAuthOptions, HookResult>({
  repository,
  session: {
    storageType: "cache",
  },
  runtime: {
    utilities,
    session,
    cacheService,
    propertiesService,
  },
  emailPassword: {
    enabled: true,
    isSignupEnabled: true,
    pepper: "test-pepper",
  },
  hooks: {
    afterSignIn: ({ user, session }) => ({
      customToken: `${user.id}:${session.id}`,
    }),
  },
});

async function withHooks() {
  const result = await auth.signIn.email({
    email: "user@example.com",
    password: "password",
  });

  const token: string = result.hooks.customToken;

  // @ts-expect-error customToken is string
  const invalidToken: number = result.hooks.customToken;

  return token;
}

const authWithoutHooks = new AppsScriptAuth<EmailPasswordAuthOptions>({
  repository,
  session: {
    storageType: "cache",
  },
  runtime: {
    utilities,
    session,
    cacheService,
    propertiesService,
  },
  emailPassword: {
    enabled: true,
    isSignupEnabled: true,
    pepper: "test-pepper",
  },
});

async function withoutHooks() {
  const result = await authWithoutHooks.signIn.email({
    email: "user@example.com",
    password: "password",
  });

  result.user;
  result.session;

  // @ts-expect-error hooks does not exist when hooks are not configured
  result.hooks;
}

void withHooks;
void withoutHooks;

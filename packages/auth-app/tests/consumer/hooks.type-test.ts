import { AppsScript, type InferAppsScript } from "@gasboost/app";
import { handlers } from "../../src/handlers";
import { AppsScriptAuth } from "@gasboost/auth";
import type { AppsScriptAuthRepository } from "@gasboost/auth";

declare const repository: AppsScriptAuthRepository;
declare const runtime: ConstructorParameters<
  typeof AppsScriptAuth
>[0]["runtime"];

const auth = new AppsScriptAuth({
  repository,
  session: {
    storageType: "cache",
  },
  runtime,
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
  const _invalidToken: number = result.hooks.customToken;

  return token;
}

const authWithoutHooks = new AppsScriptAuth({
  repository,
  session: {
    storageType: "cache",
  },
  runtime,
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

  void result.user;
  void result.session;

  const signup = await authWithoutHooks.signUp.appsScript({ name: "Taro" });
  // @ts-expect-error signup has no hooks when none are configured
  void signup.hooks;

  // @ts-expect-error hooks does not exist when hooks are not configured
  void result.hooks;
}

void withHooks;
void withoutHooks;

export const hookApp = new AppsScript().calls(handlers(auth));
export type HookApp = InferAppsScript<typeof hookApp>;
async function signupHooks() {
  const rpc = handlers(auth);
  const email = await rpc.signUpEmail({
    name: "Taro",
    email: "user",
    password: "password",
  });
  const appsScript = await rpc.signUpAppsScript({ name: "Taro" });
  const emailToken: string = email.hooks.customToken;
  const appsScriptToken: string = appsScript.hooks.customToken;
  // @ts-expect-error customToken remains string through handlers
  const invalid: number = email.hooks.customToken;
  return [emailToken, appsScriptToken, invalid];
}
void signupHooks;

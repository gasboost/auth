import type { AppsScriptAuth } from "@gasboost/auth";

type EmailPasswordOptions = ConstructorParameters<
  typeof AppsScriptAuth
>[0]["emailPassword"];

type EnabledEmailPasswordOptions = NonNullable<EmailPasswordOptions> & {
  passwordReset: NonNullable<
    NonNullable<EmailPasswordOptions>["passwordReset"]
  >;
};

type PasswordApi = NonNullable<
  AppsScriptAuth<EnabledEmailPasswordOptions>["password"]
>;

type Auth<
  TEmailPassword extends EmailPasswordOptions,
  THookResult,
> = AppsScriptAuth<TEmailPassword, THookResult>;

type BaseHandlers<TEmailPassword extends EmailPasswordOptions, THookResult> = {
  signInEmail: Auth<TEmailPassword, THookResult>["signIn"]["email"];

  signInAppsScript: Auth<TEmailPassword, THookResult>["signIn"]["appsScript"];

  signUpEmail: Auth<TEmailPassword, THookResult>["signUp"]["email"];

  signUpAppsScript: Auth<TEmailPassword, THookResult>["signUp"]["appsScript"];

  getSession: (input: {
    sessionId: Parameters<
      Auth<TEmailPassword, THookResult>["session"]["get"]
    >[0];
  }) => ReturnType<Auth<TEmailPassword, THookResult>["session"]["get"]>;

  signOut: (input: {
    sessionId: Parameters<
      Auth<TEmailPassword, THookResult>["signOut"]["execute"]
    >[0];
  }) => Promise<null>;
};

type PasswordHandlers = {
  forgotPassword: (
    input: Parameters<PasswordApi["forgot"]>[0],
  ) => Promise<null>;
  resetPassword: (input: Parameters<PasswordApi["reset"]>[0]) => Promise<null>;
};

export type AuthHandlers<
  TEmailPassword extends EmailPasswordOptions,
  THookResult,
> = BaseHandlers<TEmailPassword, THookResult> &
  (TEmailPassword extends {
    passwordReset: unknown;
  }
    ? PasswordHandlers
    : Record<never, never>);

export function handlers<
  TEmailPassword extends EmailPasswordOptions,
  THookResult,
>(
  auth: AppsScriptAuth<TEmailPassword, THookResult>,
): AuthHandlers<TEmailPassword, THookResult> {
  const baseHandlers: BaseHandlers<TEmailPassword, THookResult> = {
    signInEmail: auth.signIn.email,
    signInAppsScript: auth.signIn.appsScript,
    signUpEmail: auth.signUp.email,
    signUpAppsScript: auth.signUp.appsScript,

    getSession: ({ sessionId }) => auth.session.get(sessionId),

    signOut: async ({ sessionId }) => {
      await auth.signOut.execute(sessionId);
      return null;
    },
  };

  const password = auth.password as PasswordApi | undefined;

  if (password === undefined) {
    return baseHandlers as AuthHandlers<TEmailPassword, THookResult>;
  }

  return {
    ...baseHandlers,
    forgotPassword: async (input: Parameters<PasswordApi["forgot"]>[0]) => {
      await password.forgot(input);
      return null;
    },
    resetPassword: async (input: Parameters<PasswordApi["reset"]>[0]) => {
      await password.reset(input);
      return null;
    },
  } as AuthHandlers<TEmailPassword, THookResult>;
}

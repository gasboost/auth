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
  }) => ReturnType<Auth<TEmailPassword, THookResult>["signOut"]["execute"]>;
};

type PasswordHandlers = {
  forgotPassword: PasswordApi["forgot"];
  resetPassword: PasswordApi["reset"];
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

    signOut: ({ sessionId }) => auth.signOut.execute(sessionId),
  };

  const password = auth.password as PasswordApi | undefined;

  if (password === undefined) {
    return baseHandlers as AuthHandlers<TEmailPassword, THookResult>;
  }

  return {
    ...baseHandlers,
    forgotPassword: password.forgot.bind(password),
    resetPassword: password.reset.bind(password),
  } as AuthHandlers<TEmailPassword, THookResult>;
}

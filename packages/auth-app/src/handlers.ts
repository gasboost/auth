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
  TData = never,
> = AppsScriptAuth<TEmailPassword, THookResult, TData>;

type BaseHandlers<
  TEmailPassword extends EmailPasswordOptions,
  THookResult,
  TData,
> = {
  signInEmail: Auth<TEmailPassword, THookResult, TData>["signIn"]["email"];

  signInAppsScript: Auth<
    TEmailPassword,
    THookResult,
    TData
  >["signIn"]["appsScript"];

  signUpEmail: Auth<TEmailPassword, THookResult, TData>["signUp"]["email"];

  signUpAppsScript: Auth<
    TEmailPassword,
    THookResult,
    TData
  >["signUp"]["appsScript"];

  getSession: (input: {
    sessionId: Parameters<
      Auth<TEmailPassword, THookResult, TData>["session"]["getWithUser"]
    >[0];
  }) => ReturnType<
    Auth<TEmailPassword, THookResult, TData>["session"]["getWithUser"]
  >;

  signOut: (input: {
    sessionId: Parameters<
      Auth<TEmailPassword, THookResult, TData>["signOut"]["execute"]
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
  TData = never,
> = BaseHandlers<TEmailPassword, THookResult, TData> &
  (TEmailPassword extends {
    passwordReset: unknown;
  }
    ? PasswordHandlers
    : Record<never, never>);

export function handlers<
  TEmailPassword extends EmailPasswordOptions,
  THookResult,
  TData = never,
>(
  auth: AppsScriptAuth<TEmailPassword, THookResult, TData>,
): AuthHandlers<TEmailPassword, THookResult, TData> {
  const baseHandlers: BaseHandlers<TEmailPassword, THookResult, TData> = {
    signInEmail: auth.signIn.email,
    signInAppsScript: auth.signIn.appsScript,
    signUpEmail: auth.signUp.email,
    signUpAppsScript: auth.signUp.appsScript,

    getSession: ({ sessionId }) => auth.session.getWithUser(sessionId),

    signOut: async ({ sessionId }) => {
      await auth.signOut.execute(sessionId);
      return null;
    },
  };

  const password = auth.password as PasswordApi | undefined;

  if (password === undefined) {
    return baseHandlers as AuthHandlers<TEmailPassword, THookResult, TData>;
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
  } as AuthHandlers<TEmailPassword, THookResult, TData>;
}

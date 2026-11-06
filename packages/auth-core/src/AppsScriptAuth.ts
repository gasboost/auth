import type { UserDataProvider } from "./api/UserData";
import { AppsScriptAuthAccount } from "./api/AppsScriptAuthAccount";
import { AppsScriptAuthPassword } from "./api/AppsScriptAuthPassword";
import { AppsScriptAuthRegistration } from "./api/AppsScriptAuthRegistration";
import { AppsScriptAuthSession } from "./api/AppsScriptAuthSession";
import { AppsScriptAuthSignIn } from "./api/AppsScriptAuthSignIn";
import { AppsScriptAuthSignOut } from "./api/AppsScriptAuthSignOut";
import { AppsScriptAuthSignUp } from "./api/AppsScriptAuthSignUp";
import {
  type AppsScriptAuthenticationOptions,
  AppsScriptAuthenticationConfig,
} from "./authentication/AppsScriptAuthentication";
import {
  type EmailPasswordAuthOptions,
  EmailPasswordAuthConfig,
} from "./authentication/EmailPasswordAuthentication";
import type { SessionStorageType } from "./factory/sessionStorageFactory";
import { sessionStorageFactory } from "./factory/sessionStorageFactory";
import type { AuthHooks } from "./hooks/AuthHooks";
import { AppsScriptAuthRepository } from "./storage/AppsScriptAuthRepository";

type SessionConfig = {
  storageType: SessionStorageType;
  /** Session duration in milliseconds. Defaults to 20 minutes. */
  expiresIn?: number;
};

type AppsScriptRuntime = {
  utilities: GoogleAppsScript.Utilities.Utilities;
  session: GoogleAppsScript.Base.Session;
  cacheService: GoogleAppsScript.Cache.CacheService;
  propertiesService: GoogleAppsScript.Properties.PropertiesService;
};

type AppsScriptAuthConfig<
  TEmailPassword extends EmailPasswordAuthOptions | undefined = undefined,
  THookResult = undefined,
  TData = never,
> = {
  repository: AppsScriptAuthRepository;
  session: SessionConfig;
  runtime: AppsScriptRuntime;
  emailPassword?: TEmailPassword;
  appsScript?: AppsScriptAuthenticationOptions;
  hooks?: AuthHooks<THookResult>;
  user?: { data: UserDataProvider<TData> };
};

type AppsScriptAuthPasswordApi<TEmailPassword> = TEmailPassword extends {
  passwordReset: unknown;
}
  ? AppsScriptAuthPassword
  : undefined;

export class AppsScriptAuth<
  TEmailPassword extends EmailPasswordAuthOptions | undefined = undefined,
  THookResult = undefined,
  TData = never,
> {
  public readonly signIn: AppsScriptAuthSignIn<THookResult, TData>;

  public readonly signUp: AppsScriptAuthSignUp<THookResult, TData>;

  public readonly session: AppsScriptAuthSession<TData>;

  public readonly signOut: AppsScriptAuthSignOut;

  public readonly password: AppsScriptAuthPasswordApi<TEmailPassword>;

  public readonly registration: AppsScriptAuthRegistration;

  public readonly account: AppsScriptAuthAccount;

  constructor({
    repository,
    session,
    runtime,
    emailPassword,
    appsScript,
    hooks,
    user,
  }: AppsScriptAuthConfig<TEmailPassword, THookResult, TData>) {
    const sessionStorage = sessionStorageFactory(session.storageType, {
      cacheService: runtime.cacheService,
      propertiesService: runtime.propertiesService,
    });

    const expiresIn = session.expiresIn ?? 60 * 20 * 1000;

    const emailPasswordConfig = emailPassword
      ? new EmailPasswordAuthConfig(emailPassword)
      : undefined;

    const appsScriptConfig = appsScript
      ? new AppsScriptAuthenticationConfig(appsScript)
      : undefined;

    this.signIn = new AppsScriptAuthSignIn<THookResult, TData>({
      sessionStorage,
      userData: user?.data,
      repository,
      emailPassword: emailPasswordConfig,
      appsScript: appsScriptConfig,
      utilities: runtime.utilities,
      session: runtime.session,
      expiresIn,
      ...(hooks?.afterSignIn
        ? {
            afterSignIn: hooks.afterSignIn,
          }
        : {}),
    });

    this.signUp = new AppsScriptAuthSignUp<THookResult, TData>({
      afterSignIn: hooks?.afterSignIn,
      sessionStorage,
      userData: user?.data,
      expiresIn,
      repository,
      emailPassword: emailPasswordConfig,
      appsScript: appsScriptConfig,
      utilities: runtime.utilities,
      session: runtime.session,
    });

    this.session = new AppsScriptAuthSession<TData>({
      repository,
      sessionStorage,
      userData: user?.data,
    });

    this.signOut = new AppsScriptAuthSignOut(sessionStorage);

    this.password = (
      emailPasswordConfig?.passwordReset
        ? new AppsScriptAuthPassword({
            repository,
            utilities: runtime.utilities,
            emailPassword: emailPasswordConfig,
          })
        : undefined
    ) as AppsScriptAuthPasswordApi<TEmailPassword>;

    this.account = new AppsScriptAuthAccount({
      emailPassword: emailPasswordConfig,
      appsScript: appsScriptConfig,
      repository,
      utilities: runtime.utilities,
    });

    this.registration = new AppsScriptAuthRegistration({
      emailPassword: emailPasswordConfig,
      appsScript: appsScriptConfig,
      repository,
      utilities: runtime.utilities,
    });
  }
}

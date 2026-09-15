import { AppsScriptAuthPassword } from "./api/AppsScriptAuthPassword";
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
> = {
  repository: AppsScriptAuthRepository;
  session: SessionConfig;
  runtime: AppsScriptRuntime;
  emailPassword?: TEmailPassword;
  appsScript?: AppsScriptAuthenticationOptions;
  hooks?: AuthHooks<THookResult>;
};

type AppsScriptAuthPasswordApi<TEmailPassword> = TEmailPassword extends {
  passwordReset: unknown;
}
  ? AppsScriptAuthPassword
  : undefined;

export class AppsScriptAuth<
  TEmailPassword extends EmailPasswordAuthOptions | undefined = undefined,
  THookResult = undefined,
> {
  public readonly signIn: AppsScriptAuthSignIn<THookResult>;

  public readonly signUp: AppsScriptAuthSignUp;

  public readonly session: AppsScriptAuthSession;

  public readonly signOut: AppsScriptAuthSignOut;

  public readonly password: AppsScriptAuthPasswordApi<TEmailPassword>;

  constructor({
    repository,
    session,
    runtime,
    emailPassword,
    appsScript,
    hooks,
  }: AppsScriptAuthConfig<TEmailPassword, THookResult>) {
    const sessionStorage = sessionStorageFactory(session.storageType, {
      cacheService: runtime.cacheService,
      propertiesService: runtime.propertiesService,
    });

    const expiresIn = session.expiresIn ?? 60 * 20;

    const emailPasswordConfig = emailPassword
      ? new EmailPasswordAuthConfig(emailPassword)
      : undefined;

    const appsScriptConfig = appsScript
      ? new AppsScriptAuthenticationConfig(appsScript)
      : undefined;

    this.signIn = new AppsScriptAuthSignIn<THookResult>({
      sessionStorage,
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

    this.signUp = new AppsScriptAuthSignUp({
      sessionStorage,
      expiresIn,
      repository,
      emailPassword: emailPasswordConfig,
      appsScript: appsScriptConfig,
      utilities: runtime.utilities,
      session: runtime.session,
    });

    this.session = new AppsScriptAuthSession({
      sessionStorage,
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
  }
}

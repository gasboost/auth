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

type BaseHandlers<THookResult> = {
  signInEmail: AppsScriptAuthSignIn<THookResult>["email"];
  signInAppsScript: AppsScriptAuthSignIn<THookResult>["appsScript"];
  signUpEmail: AppsScriptAuthSignUp["email"];
  signUpAppsScript: AppsScriptAuthSignUp["appsScript"];
  getSession: AppsScriptAuthSession["get"];
  signOut: AppsScriptAuthSignOut["execute"];
};

type PasswordHandlers = {
  forgotPassword: AppsScriptAuthPassword["forgot"];
  resetPassword: AppsScriptAuthPassword["reset"];
};

type AppsScriptAuthHandlers<TEmailPassword, THookResult> =
  TEmailPassword extends {
    passwordReset: unknown;
  }
    ? BaseHandlers<THookResult> & PasswordHandlers
    : BaseHandlers<THookResult>;

export class AppsScriptAuth<
  TEmailPassword extends EmailPasswordAuthOptions | undefined = undefined,
  THookResult = undefined,
> {
  public readonly signIn: AppsScriptAuthSignIn<THookResult>;

  public readonly signUp: AppsScriptAuthSignUp;
  public readonly session: AppsScriptAuthSession;
  public readonly signOut: AppsScriptAuthSignOut;
  public readonly password: AppsScriptAuthPassword | undefined;

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

    if (emailPasswordConfig?.passwordReset) {
      this.password = new AppsScriptAuthPassword({
        repository,
        utilities: runtime.utilities,
        emailPassword: emailPasswordConfig,
      });
    } else {
      this.password = undefined;
    }
  }

  public get handlers(): AppsScriptAuthHandlers<TEmailPassword, THookResult> {
    const handlers = {
      signInEmail: this.signIn.email,
      signInAppsScript: this.signIn.appsScript,
      signUpEmail: this.signUp.email,
      signUpAppsScript: this.signUp.appsScript,
      getSession: this.session.get.bind(this.session),
      signOut: this.signOut.execute.bind(this.signOut),

      ...(this.password
        ? {
            forgotPassword: this.password.forgot.bind(this.password),
            resetPassword: this.password.reset.bind(this.password),
          }
        : {}),
    };

    return handlers as AppsScriptAuthHandlers<TEmailPassword, THookResult>;
  }
}

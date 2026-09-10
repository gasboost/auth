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

type AppsScriptAuthConfig = {
  repository: AppsScriptAuthRepository;
  session: SessionConfig;
  runtime: AppsScriptRuntime;
  emailPassword?: EmailPasswordAuthOptions;
  appsScript?: AppsScriptAuthenticationOptions;
};

export class AppsScriptAuth {
  public readonly signIn: AppsScriptAuthSignIn;
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
  }: AppsScriptAuthConfig) {
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

    this.signIn = new AppsScriptAuthSignIn({
      sessionStorage,
      repository,
      emailPassword: emailPasswordConfig,
      appsScript: appsScriptConfig,
      utilities: runtime.utilities,
      session: runtime.session,
      expiresIn,
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

    if (emailPasswordConfig) {
      this.password = new AppsScriptAuthPassword({
        repository,
        utilities: runtime.utilities,
        emailPassword: emailPasswordConfig,
      });
    } else {
      this.password = undefined;
    }
  }
}

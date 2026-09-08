import { AppsScriptAuthSession } from "./api/AppsScriptAuthSession";
import { AppsScriptAuthSignIn } from "./api/AppsScriptAuthSignIn";
import { AppsScriptAuthSignOut } from "./api/AppsScriptAuthSignOut";
import { AppsScriptAuthSignUp } from "./api/AppsScriptAuthSignUp";
import { type AppsScriptAuthenticationConfig } from "./authentication/AppsScriptAuthentication";
import { type EmailPasswordAuthConfig } from "./authentication/EmailPasswordAuthentication";
import type { SessionStorageType } from "./factory/sessionStorageFactory";
import { sessionStorageFactory } from "./factory/sessionStorageFactory";
import { AppsScriptAuthRepository } from "./storage/AppsScriptAuthRepository";

type SessionConfig = {
  storageType: SessionStorageType;
  expiresIn?: number;
};

type AppsScriptAuthConfig = {
  repository: AppsScriptAuthRepository;
  session: SessionConfig;
  emailPassword?: EmailPasswordAuthConfig;
  appsScript?: AppsScriptAuthenticationConfig;
};

export class AppsScriptAuth {
  public readonly signIn: AppsScriptAuthSignIn;
  public readonly signUp: AppsScriptAuthSignUp;
  public readonly session: AppsScriptAuthSession;
  public readonly signOut: AppsScriptAuthSignOut;

  constructor({
    repository,
    session,
    emailPassword,
    appsScript,
  }: AppsScriptAuthConfig) {
    const sessionStorage = sessionStorageFactory(session.storageType);
    const expiresIn = session.expiresIn ?? 60 * 20;

    this.signIn = new AppsScriptAuthSignIn({
      sessionStorage,
      repository,
      emailPassword,
      appsScript,
      utilities: Utilities,
      session: Session,
      expiresIn,
    });

    this.signUp = new AppsScriptAuthSignUp({
      sessionStorage,
      expiresIn,
      repository,
      emailPassword,
      appsScript,
      utilities: Utilities,
      session: Session,
    });

    this.session = new AppsScriptAuthSession({
      sessionStorage,
    });

    this.signOut = new AppsScriptAuthSignOut(sessionStorage);
  }
}

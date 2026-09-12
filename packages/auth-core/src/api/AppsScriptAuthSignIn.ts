import type { AppsScriptAuthenticationConfig } from "../authentication/AppsScriptAuthentication";
import {
  AppsScriptAuthentication,
  type AppsScriptCredential,
} from "../authentication/AppsScriptAuthentication";
import type { EmailPasswordAuthConfig } from "../authentication/EmailPasswordAuthentication";
import {
  EmailPasswordAuthentication,
  type EmailPasswordCredential,
} from "../authentication/EmailPasswordAuthentication";
import type { AfterSignInHook } from "../hooks/AuthHooks";
import { AppsScriptAuthRepository } from "../storage/AppsScriptAuthRepository";
import { AppsScriptSessionStorage } from "../storage/AppsScriptSessionStorage";
import { SignIn } from "./SignIn";

export class AppsScriptAuthSignIn<THookResult = undefined> {
  public email: SignIn<EmailPasswordCredential, THookResult>["execute"];

  public appsScript: SignIn<AppsScriptCredential, THookResult>["execute"];

  constructor({
    sessionStorage,
    expiresIn,
    repository,
    emailPassword,
    appsScript,
    session,
    utilities,
    afterSignIn,
  }: {
    sessionStorage: AppsScriptSessionStorage;
    repository: AppsScriptAuthRepository;
    emailPassword?: EmailPasswordAuthConfig;
    appsScript?: AppsScriptAuthenticationConfig;
    utilities: GoogleAppsScript.Utilities.Utilities;
    session: GoogleAppsScript.Base.Session;
    expiresIn: number;
    afterSignIn?: AfterSignInHook<THookResult>;
  }) {
    this.email = async (credential) => {
      if (!emailPassword) {
        throw new Error("Email and password authentication is disabled");
      }

      emailPassword.ensureSignInEnabled();

      const emailSignIn = new SignIn<EmailPasswordCredential, THookResult>({
        sessionStorage,
        authentication: new EmailPasswordAuthentication(
          repository,
          utilities,
          emailPassword,
        ),
        utilities,
        expiresIn,
        ...(afterSignIn
          ? {
              afterSignIn,
            }
          : {}),
      });

      return emailSignIn.execute(credential);
    };

    this.appsScript = async (credential) => {
      if (!appsScript) {
        throw new Error("Apps Script authentication is disabled");
      }

      appsScript.ensureSignInEnabled();

      return new SignIn<AppsScriptCredential, THookResult>({
        sessionStorage,
        authentication: new AppsScriptAuthentication(repository, session),
        utilities,
        expiresIn,
        ...(afterSignIn
          ? {
              afterSignIn,
            }
          : {}),
      }).execute(credential);
    };
  }
}

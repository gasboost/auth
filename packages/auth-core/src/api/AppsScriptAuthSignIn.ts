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
import { AppsScriptAuthRepository } from "../storage/AppsScriptAuthRepository";
import { AppsScriptSessionStorage } from "../storage/AppsScriptSessionStorage";
import { SignIn } from "./SignIn";

export class AppsScriptAuthSignIn {
  public email: SignIn<EmailPasswordCredential>["execute"];
  public appsScript: SignIn<AppsScriptCredential>["execute"];

  constructor({
    sessionStorage,
    expiresIn,
    repository,
    emailPassword,
    appsScript,
    session,
    utilities,
  }: {
    sessionStorage: AppsScriptSessionStorage;
    repository: AppsScriptAuthRepository;
    emailPassword?: EmailPasswordAuthConfig;
    appsScript?: AppsScriptAuthenticationConfig;
    utilities: GoogleAppsScript.Utilities.Utilities;
    session: GoogleAppsScript.Base.Session;
    expiresIn: number;
  }) {
    this.email = async (credential) => {
      if (!emailPassword) {
        throw new Error("Email and password authentication is disabled");
      }

      emailPassword.ensureSignInEnabled();

      const emailSignIn = new SignIn({
        sessionStorage,
        authentication: new EmailPasswordAuthentication(
          repository,
          utilities,
          emailPassword.pepper,
        ),
        utilities,
        expiresIn,
      });

      return emailSignIn.execute(credential);
    };

    this.appsScript = async (credential) => {
      if (!appsScript) {
        throw new Error("Apps Script authentication is disabled");
      }

      appsScript.ensureSignInEnabled();

      return new SignIn({
        sessionStorage,
        authentication: new AppsScriptAuthentication(repository, session),
        utilities,
        expiresIn,
      }).execute(credential);
    };
  }
}

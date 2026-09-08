import type { AppsScriptAuthenticationConfig } from "../authentication/AppsScriptAuthentication";
import type { EmailPasswordAuthConfig } from "../authentication/EmailPasswordAuthentication";
import {
  AppsScriptRegistration,
  type AppsScriptRegistrationInput,
} from "../registration/AppsScriptRegistration";
import {
  EmailPasswordRegistration,
  type EmailPasswordRegistrationInput,
} from "../registration/EmailPasswordRegistration";
import type { AppsScriptAuthRepository } from "../storage/AppsScriptAuthRepository";
import type { AppsScriptSessionStorage } from "../storage/AppsScriptSessionStorage";
import { SignUp } from "./SignUp";

export class AppsScriptAuthSignUp {
  public email: SignUp<EmailPasswordRegistrationInput>["execute"];
  public appsScript: SignUp<AppsScriptRegistrationInput>["execute"];

  constructor({
    sessionStorage,
    expiresIn,
    repository,
    emailPassword,
    appsScript,
    utilities,
    session,
  }: {
    sessionStorage: AppsScriptSessionStorage;
    expiresIn: number;
    repository: AppsScriptAuthRepository;
    emailPassword?: EmailPasswordAuthConfig;
    appsScript?: AppsScriptAuthenticationConfig;
    utilities: GoogleAppsScript.Utilities.Utilities;
    session: GoogleAppsScript.Base.Session;
  }) {
    const emailSignUp = new SignUp({
      sessionStorage,
      expiresIn,
      registration: new EmailPasswordRegistration(
        repository,
        utilities,
        emailPassword?.pepper ?? "",
      ),
      utilities,
    });

    const appsScriptSignUp = new SignUp({
      sessionStorage,
      expiresIn,
      registration: new AppsScriptRegistration(utilities, session, repository),
      utilities,
    });

    this.email = async (input) => {
      if (emailPassword?.enabled !== true) {
        throw new Error("Email and password authentication is disabled");
      }

      if (emailPassword.isSignupEnabled === false) {
        throw new Error("Email and password signup is disabled");
      }

      return emailSignUp.execute(input);
    };

    this.appsScript = async (input) => {
      if (appsScript?.enabled !== true) {
        throw new Error("Apps Script authentication is disabled");
      }

      return appsScriptSignUp.execute(input);
    };
  }
}

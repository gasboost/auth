import type { AppsScriptAuthenticationConfig } from "../authentication/AppsScriptAuthentication";
import type { EmailPasswordAuthConfig } from "../authentication/EmailPasswordAuthentication";
import type { AfterSignInHook } from "../hooks/AuthHooks";
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

export class AppsScriptAuthSignUp<THookResult = undefined> {
  public email: SignUp<EmailPasswordRegistrationInput, THookResult>["execute"];
  public appsScript: SignUp<
    AppsScriptRegistrationInput,
    THookResult
  >["execute"];

  constructor({
    sessionStorage,
    expiresIn,
    afterSignIn,
    repository,
    emailPassword,
    appsScript,
    utilities,
    session,
  }: {
    sessionStorage: AppsScriptSessionStorage;
    expiresIn: number;
    afterSignIn?: AfterSignInHook<THookResult>;
    repository: AppsScriptAuthRepository;
    emailPassword?: EmailPasswordAuthConfig;
    appsScript?: AppsScriptAuthenticationConfig;
    utilities: GoogleAppsScript.Utilities.Utilities;
    session: GoogleAppsScript.Base.Session;
  }) {
    this.email = async (input) => {
      if (!emailPassword) {
        throw new Error("Email and password authentication is disabled");
      }

      emailPassword.ensureSignUpEnabled();

      const emailSignUp = new SignUp({
        sessionStorage,
        afterSignIn,
        expiresIn,
        registration: new EmailPasswordRegistration(
          repository,
          utilities,
          emailPassword,
        ),
        utilities,
      });

      return emailSignUp.execute(input);
    };

    this.appsScript = async (input) => {
      if (!appsScript) {
        throw new Error("Apps Script authentication is disabled");
      }

      appsScript.ensureSignUpEnabled();

      const appsScriptSignUp = new SignUp({
        sessionStorage,
        afterSignIn,
        expiresIn,
        registration: new AppsScriptRegistration(
          utilities,
          session,
          repository,
        ),
        utilities,
      });

      return appsScriptSignUp.execute(input);
    };
  }
}

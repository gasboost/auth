import { AuthError, AUTH_ERROR_CODES } from "../errors";
import type { UserDataProvider } from "./UserData";
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

export class AppsScriptAuthSignUp<THookResult = undefined, TData = never> {
  public email: SignUp<
    EmailPasswordRegistrationInput,
    THookResult,
    TData
  >["execute"];
  public appsScript: SignUp<
    Pick<AppsScriptRegistrationInput, "name">,
    THookResult,
    TData
  >["execute"];

  constructor({
    sessionStorage,
    expiresIn,
    afterSignIn,
    userData,
    repository,
    emailPassword,
    appsScript,
    utilities,
    session,
  }: {
    sessionStorage: AppsScriptSessionStorage;
    expiresIn: number;
    afterSignIn?: AfterSignInHook<THookResult>;
    userData?: UserDataProvider<TData>;
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
        userData,
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

      const email = session.getActiveUser().getEmail();
      if (!email)
        throw new AuthError({
          code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
          message: "Invalid credentials",
        });

      const appsScriptSignUp = new SignUp({
        sessionStorage,
        userData,
        afterSignIn,
        expiresIn,
        registration: new AppsScriptRegistration(utilities, repository),
        utilities,
      });

      return appsScriptSignUp.execute({ name: input.name, email });
    };
  }
}

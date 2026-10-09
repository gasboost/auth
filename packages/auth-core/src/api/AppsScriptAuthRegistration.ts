import type { AppsScriptAuthenticationConfig } from "../authentication/AppsScriptAuthentication";
import type { EmailPasswordAuthConfig } from "../authentication/EmailPasswordAuthentication";
import type { User } from "../domain/User";
import {
  AppsScriptRegistration,
  type AppsScriptRegistrationInput,
} from "../registration/AppsScriptRegistration";
import {
  EmailPasswordRegistration,
  type EmailPasswordRegistrationInput,
} from "../registration/EmailPasswordRegistration";
import type { AppsScriptAuthRepository } from "../storage/AppsScriptAuthRepository";

export class AppsScriptAuthRegistration {
  private readonly emailPasswordRegistration?: EmailPasswordRegistration;
  private readonly appsScriptRegistration?: AppsScriptRegistration;

  constructor({
    emailPassword,
    appsScript,
    repository,
    utilities,
    session,
  }: {
    emailPassword?: EmailPasswordAuthConfig;
    appsScript?: AppsScriptAuthenticationConfig;
    repository: AppsScriptAuthRepository;
    utilities: GoogleAppsScript.Utilities.Utilities;
    session: GoogleAppsScript.Base.Session;
  }) {
    if (emailPassword?.enabled) {
      this.emailPasswordRegistration = new EmailPasswordRegistration(
        repository,
        utilities,
        emailPassword,
      );
    }

    if (appsScript?.enabled) {
      this.appsScriptRegistration = new AppsScriptRegistration(
        utilities,
        session,
        repository,
      );
    }
  }

  async email(input: EmailPasswordRegistrationInput): Promise<User> {
    if (!this.emailPasswordRegistration) {
      throw new Error("Email and password authentication is disabled");
    }

    return this.emailPasswordRegistration.register(input);
  }

  async appsScript(input: AppsScriptRegistrationInput): Promise<User> {
    if (!this.appsScriptRegistration) {
      throw new Error("Apps Script authentication is disabled");
    }

    return this.appsScriptRegistration.register(input);
  }
}

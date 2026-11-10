import type { AppsScriptAuthenticationConfig } from "../authentication/AppsScriptAuthentication";
import type { EmailPasswordAuthConfig } from "../authentication/EmailPasswordAuthentication";
import { UserDTO } from "../dto/UserDTO";
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

  public readonly methods: {
    readonly emailPassword: boolean;
    readonly appsScript: boolean;
  };

  constructor({
    emailPassword,
    appsScript,
    repository,
    utilities,
  }: {
    emailPassword?: EmailPasswordAuthConfig;
    appsScript?: AppsScriptAuthenticationConfig;
    repository: AppsScriptAuthRepository;
    utilities: GoogleAppsScript.Utilities.Utilities;
  }) {
    this.methods = Object.freeze({
      emailPassword: !!emailPassword?.enabled,
      appsScript: !!appsScript?.enabled,
    });
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
        repository,
      );
    }
  }

  async email(input: EmailPasswordRegistrationInput): Promise<UserDTO> {
    if (!this.emailPasswordRegistration) {
      throw new Error("Email and password authentication is disabled");
    }

    return new UserDTO(await this.emailPasswordRegistration.register(input));
  }

  async appsScript(input: AppsScriptRegistrationInput): Promise<UserDTO> {
    if (!this.appsScriptRegistration) {
      throw new Error("Apps Script authentication is disabled");
    }

    return new UserDTO(await this.appsScriptRegistration.register(input));
  }
}

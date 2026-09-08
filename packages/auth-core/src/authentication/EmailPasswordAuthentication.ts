import { authPattern } from "../AuthPattern";
import { Password } from "../domain/Password";
import type { User } from "../domain/User";
import { EmailPasswordIdentity } from "../identity/EmailPasswordIdentity";
import type { AppsScriptAuthRepository } from "../storage/AppsScriptAuthRepository";
import type { Authentication } from "./Authentication";

// https://better-auth.com/docs/authentication/email-password#configuration
export type EmailPasswordAuthConfig = {
  enabled?: boolean;
  isSignupEnabled?: boolean;
  pepper: string;
};

export interface EmailPasswordCredential {
  readonly email: string;
  readonly password: string;
}

export class EmailPasswordAuthentication implements Authentication<EmailPasswordCredential> {
  constructor(
    private readonly repository: AppsScriptAuthRepository,
    private readonly utilities: GoogleAppsScript.Utilities.Utilities,
    private readonly pepper: string,
  ) {}

  async verify(credential: EmailPasswordCredential): Promise<User> {
    const account = await this.repository.account.findByIdentity(
      authPattern.emailPassword,
      credential.email,
    );

    if (!account) {
      throw new Error("Account not found");
    }

    if (!(account.identity instanceof EmailPasswordIdentity)) {
      throw new Error("Invalid identity");
    }

    const password = new Password(
      credential.password,
      this.utilities,
      this.pepper,
    );

    if (!(await account.identity.verify(password))) {
      throw new Error("Invalid password");
    }

    const user = await this.repository.user.find(account.userId);

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }
}

import { authPattern } from "../AuthPattern";
import { Password } from "../domain/Password";
import type { User } from "../domain/User";
import { EmailPasswordIdentity } from "../identity/EmailPasswordIdentity";
import type { AppsScriptAuthRepository } from "../storage/AppsScriptAuthRepository";
import type { Authentication } from "./Authentication";

export type EmailPasswordAuthOptions = {
  enabled?: boolean;
  isSignupEnabled?: boolean;
  pepper: string;
};

export class EmailPasswordAuthConfig {
  public readonly enabled: boolean;
  public readonly isSignupEnabled: boolean;
  public readonly pepper: string;

  constructor({
    enabled = false,
    isSignupEnabled = true,
    pepper,
  }: {
    enabled?: boolean;
    isSignupEnabled?: boolean;
    pepper: string;
  }) {
    if (enabled && !pepper.trim()) {
      throw new Error(
        "Pepper is required when email and password authentication is enabled",
      );
    }

    this.enabled = enabled;
    this.isSignupEnabled = isSignupEnabled;
    this.pepper = pepper;
  }
  public ensureSignInEnabled(): void {
    if (!this.enabled) {
      throw new Error("Email and password authentication is disabled");
    }
  }

  public ensureSignUpEnabled(): void {
    this.ensureSignInEnabled();

    if (!this.isSignupEnabled) {
      throw new Error("Email and password signup is disabled");
    }
  }
}

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

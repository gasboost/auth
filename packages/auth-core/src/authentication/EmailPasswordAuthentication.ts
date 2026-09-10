import type { PasswordResetDelivery } from "../api/AppsScriptAuthPassword";
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
  iterations?: number;
  passwordReset?: {
    delivery: PasswordResetDelivery;
    expiresIn?: number;
  };
};
export class EmailPasswordAuthConfig {
  public static readonly DEFAULT_ITERATIONS = 300;
  public static readonly MAX_ITERATIONS = 1000;

  public readonly enabled: boolean;
  public readonly isSignupEnabled: boolean;
  public readonly pepper: string;
  public readonly iterations: number;
  public readonly passwordReset?: {
    delivery: PasswordResetDelivery;
    expiresIn?: number;
  };

  constructor({
    enabled = false,
    isSignupEnabled = true,
    pepper,
    iterations = EmailPasswordAuthConfig.DEFAULT_ITERATIONS,
    passwordReset,
  }: EmailPasswordAuthOptions) {
    if (enabled && !pepper.trim()) {
      throw new Error(
        "Pepper is required when email and password authentication is enabled",
      );
    }

    this.ensureIterationsWithinLimit(iterations);

    this.enabled = enabled;
    this.isSignupEnabled = isSignupEnabled;
    this.pepper = pepper;
    this.iterations = iterations;
    this.passwordReset = passwordReset;
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

  public ensureIterationsWithinLimit(iterations: number): void {
    if (!Number.isInteger(iterations) || iterations < 1) {
      throw new Error("Password hash iterations must be a positive integer");
    }

    if (iterations > EmailPasswordAuthConfig.MAX_ITERATIONS) {
      throw new Error(
        `Password hash iterations must not exceed ${EmailPasswordAuthConfig.MAX_ITERATIONS}`,
      );
    }
  }

  public ensurePasswordResetEnabled(): void {
    if (!this.passwordReset) {
      throw new Error("Password reset is not enabled");
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
    private readonly config: EmailPasswordAuthConfig,
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
      this.config.pepper,
      this.config.iterations,
    );

    if (!(await account.identity.verify(password, account.id))) {
      throw new Error("Invalid password");
    }

    const user = await this.repository.user.find(account.userId);

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }
}

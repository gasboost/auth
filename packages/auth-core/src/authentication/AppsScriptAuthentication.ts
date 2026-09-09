import { authPattern } from "../AuthPattern";
import { User } from "../domain/User";
import { AppsScriptIdentity } from "../identity/AppsScriptIdentity";
import type { AppsScriptAuthRepository } from "../storage/AppsScriptAuthRepository";
import type { Authentication } from "./Authentication";

export type AppsScriptAuthenticationOptions = {
  enabled?: boolean;
  isSignupEnabled?: boolean;
};

export class AppsScriptAuthenticationConfig {
  public readonly enabled: boolean;
  public readonly isSignupEnabled: boolean;

  constructor({
    enabled = false,
    isSignupEnabled = true,
  }: {
    enabled?: boolean;
    isSignupEnabled?: boolean;
  }) {
    this.enabled = enabled;
    this.isSignupEnabled = isSignupEnabled;
  }

  public ensureSignInEnabled(): void {
    if (!this.enabled) {
      throw new Error("Apps Script authentication is disabled");
    }
  }

  public ensureSignUpEnabled(): void {
    this.ensureSignInEnabled();

    if (!this.isSignupEnabled) {
      throw new Error("Apps Script signup is disabled");
    }
  }
}

export type AppsScriptCredential = Record<string, never>;

export class AppsScriptAuthentication implements Authentication<AppsScriptCredential> {
  constructor(
    private readonly repository: AppsScriptAuthRepository,
    private readonly session: GoogleAppsScript.Base.Session,
  ) {}

  async verify(__credential: AppsScriptCredential): Promise<User> {
    const email = this.session.getActiveUser().getEmail();

    if (!email) {
      throw new Error("No active user found");
    }

    const account = await this.repository.account.findByIdentity(
      authPattern.appsScript,
      email,
    );

    if (!account) {
      throw new Error("Account not found");
    }

    if (!(account.identity instanceof AppsScriptIdentity)) {
      throw new Error("Invalid identity");
    }

    const user = await this.repository.user.find(account.userId);

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }
}

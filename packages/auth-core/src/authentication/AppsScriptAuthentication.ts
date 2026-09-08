import { authPattern } from "../AuthPattern";
import { User } from "../domain/User";
import { AppsScriptIdentity } from "../identity/AppsScriptIdentity";
import type { AppsScriptAuthRepository } from "../storage/AppsScriptAuthRepository";
import type { Authentication } from "./Authentication";

export type AppsScriptAuthenticationConfig = {
  enabled?: boolean;
  isSignupEnabled?: boolean;
};

export interface AppsScriptCredential {}

export class AppsScriptAuthentication implements Authentication<AppsScriptCredential> {
  constructor(
    private readonly repository: AppsScriptAuthRepository,
    private readonly session: GoogleAppsScript.Base.Session,
  ) {}

  async verify(credential: AppsScriptCredential): Promise<User> {
    const email = this.session.getActiveUser().getEmail();

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

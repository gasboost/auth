import { AuthError, AUTH_ERROR_CODES } from "../errors";
import { authPattern } from "../AuthPattern";
import { Account } from "../domain/Account";
import { User } from "../domain/User";
import { AppsScriptIdentity } from "../identity/AppsScriptIdentity";
import type { AppsScriptAuthRepository } from "../storage/AppsScriptAuthRepository";
import type { Registration } from "./Registration";

export interface AppsScriptRegistrationInput {
  readonly name: string;
  readonly email: string;
}

export class AppsScriptRegistration implements Registration<AppsScriptRegistrationInput> {
  constructor(
    private readonly utilities: GoogleAppsScript.Utilities.Utilities,
    private readonly repository: AppsScriptAuthRepository,
  ) {}
  async register(input: AppsScriptRegistrationInput): Promise<User> {
    const email = input.email;
    if (!email?.trim()) throw new Error("Email is required");

    const existingAccount = await this.repository.account.findByIdentity(
      authPattern.appsScript,
      email,
    );

    if (existingAccount) {
      throw new AuthError({
        code: AUTH_ERROR_CODES.REGISTRATION_FAILED,
        message: "Registration failed",
      });
    }

    // AppsScriptIdentity作成
    const appsScriptIdentity = new AppsScriptIdentity({
      googleAccountAddress: email,
    });

    const userId = this.utilities.getUuid();

    // Account作成
    const account = new Account({
      id: this.utilities.getUuid(),
      userId: userId,
      identity: appsScriptIdentity,
    });

    // User作成
    const user = new User({
      id: userId,
      name: input.name,
      accounts: [account],
    });

    // 永続化
    await this.repository.user.create(user);

    // User返却
    return user;
  }
}

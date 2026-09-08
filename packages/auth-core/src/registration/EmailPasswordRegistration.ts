import { authPattern } from "../AuthPattern";
import { Account } from "../domain/Account";
import { Password } from "../domain/Password";
import { User } from "../domain/User";
import { EmailPasswordIdentity } from "../identity/EmailPasswordIdentity";
import type { AppsScriptAuthRepository } from "../storage/AppsScriptAuthRepository";
import type { Registration } from "./Registration";

export interface EmailPasswordRegistrationInput {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

export class EmailPasswordRegistration implements Registration<EmailPasswordRegistrationInput> {
  constructor(
    private readonly repository: AppsScriptAuthRepository,
    private readonly utilities: GoogleAppsScript.Utilities.Utilities,
    private readonly pepper: string,
  ) {}

  async register(input: EmailPasswordRegistrationInput): Promise<User> {
    const existingAccount = await this.repository.account.findByIdentity(
      authPattern.emailPassword,
      input.email,
    );

    if (existingAccount) {
      throw new Error("Account already registered");
    }

    const password = new Password(input.password, this.utilities, this.pepper);

    const hashedPassword = await password.hash();

    const identity = new EmailPasswordIdentity({
      accountId: input.email,
      password: hashedPassword,
    });

    const userId = this.utilities.getUuid();

    const account = new Account({
      id: this.utilities.getUuid(),
      userId,
      identity,
    });

    const user = new User({
      id: userId,
      name: input.name,
      accounts: [account],
    });

    await this.repository.user.create(user);

    return user;
  }
}

import type { AppsScriptAuthenticationConfig } from "../authentication/AppsScriptAuthentication";
import type { EmailPasswordAuthConfig } from "../authentication/EmailPasswordAuthentication";
import { authPattern } from "../AuthPattern";
import { Account } from "../domain/Account";
import { Password } from "../domain/Password";
import { AppsScriptIdentity } from "../identity/AppsScriptIdentity";
import { EmailPasswordIdentity } from "../identity/EmailPasswordIdentity";
import type { AppsScriptAuthRepository } from "../storage/AppsScriptAuthRepository";

export type AddAccountInput =
  | { provider: "appsScript"; email: string }
  | { provider: "emailPassword"; email: string; password: string };

/** Server API. The caller must authorize account linking to the specified user. */
export class AppsScriptAuthAccount {
  constructor(
    private readonly config: {
      repository: AppsScriptAuthRepository;
      utilities: GoogleAppsScript.Utilities.Utilities;
      emailPassword?: EmailPasswordAuthConfig;
      appsScript?: AppsScriptAuthenticationConfig;
    },
  ) {}

  public async findByIdentity(
    provider: "appsScript" | "emailPassword",
    email: string,
  ): Promise<Account | null> {
    if (
      (provider !== "appsScript" && provider !== "emailPassword") ||
      !email?.trim()
    )
      throw new Error("Provider and email are required");
    return this.config.repository.account.findByIdentity(provider, email);
  }

  async add(userId: string, input: AddAccountInput): Promise<Account> {
    const { repository, utilities, emailPassword, appsScript } = this.config;
    if (!userId?.trim() || !input.email?.trim())
      throw new Error("User ID and email are required");
    switch (input.provider) {
      case authPattern.emailPassword:
        if (!emailPassword?.enabled)
          throw new Error("Email and password authentication is disabled");
        break;
      case authPattern.appsScript:
        if (!appsScript?.enabled)
          throw new Error("Apps Script authentication is disabled");
        break;
      default:
        throw new Error("Unsupported auth provider");
    }
    if (!repository.account.create)
      throw new Error("Repository must support account.create");
    const user = await repository.user.find(userId);
    if (!user || user.id !== userId) throw new Error("User not found");
    if (user.account(input.provider))
      throw new Error("User already has an account for this provider");
    if (await repository.account.findByIdentity(input.provider, input.email))
      throw new Error("Account already registered");

    const id = utilities.getUuid();
    const identity =
      input.provider === authPattern.emailPassword
        ? new EmailPasswordIdentity({
            accountId: input.email,
            password: await new Password(
              input.password,
              utilities,
              emailPassword!.pepper,
              emailPassword!.iterations,
            ).hash(id),
          })
        : new AppsScriptIdentity({ googleAccountAddress: input.email });
    return repository.account.create(new Account({ id, userId, identity }));
  }
}

import type { AppsScriptAuthenticationConfig } from "../authentication/AppsScriptAuthentication";
import type { EmailPasswordAuthConfig } from "../authentication/EmailPasswordAuthentication";
import { User } from "../domain/User";
import { Account } from "../domain/Account";
import { Password } from "../domain/Password";
import { authPattern } from "../AuthPattern";
import { AppsScriptIdentity } from "../identity/AppsScriptIdentity";
import { EmailPasswordIdentity } from "../identity/EmailPasswordIdentity";
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
  private readonly repository: AppsScriptAuthRepository;
  private readonly utilities: GoogleAppsScript.Utilities.Utilities;
  private readonly session: GoogleAppsScript.Base.Session;
  private readonly emailPassword?: EmailPasswordAuthConfig;

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
    this.repository = repository;
    this.utilities = utilities;
    this.session = session;
    this.emailPassword = emailPassword;
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
  /** Privileged server API. Caller must authorize and serialize provisioning. */
  public async ensure(input: {
    id: string;
    name: string;
    email: string;
    password?: string;
  }): Promise<User> {
    return this.provision(input, "active");
  }

  /** Privileged server API for token-authorized USER_DEPLOYING setup. Not visitor authentication. */
  public async ensureEffectiveUser(input: {
    id: string;
    name: string;
    email: string;
    password?: string;
  }): Promise<User> {
    return this.provision(input, "effective");
  }

  private async provision(
    input: {
      id: string;
      name: string;
      email: string;
      password?: string;
    },
    identity: "active" | "effective",
  ): Promise<User> {
    if (!this.methods.emailPassword && !this.methods.appsScript) {
      throw new Error("No authentication method is enabled");
    }
    if (!input.id || !input.email.trim())
      throw new Error("User ID and email are required");
    if (!this.repository.user.save)
      throw new Error("Repository must support idempotent user.save");
    if (identity === "effective") {
      const email = this.session.getEffectiveUser().getEmail();
      if (!email || email !== input.email)
        throw new Error("Effective user does not match registration email");
    } else if (
      this.methods.appsScript &&
      this.session.getActiveUser().getEmail() !== input.email
    ) {
      throw new Error("Active user does not match registration email");
    }
    const existing = await this.repository.user.find(input.id);
    const accounts = [...(existing?.accounts ?? [])];
    for (const provider of [
      authPattern.emailPassword,
      authPattern.appsScript,
    ]) {
      if (
        provider === authPattern.emailPassword
          ? !this.methods.emailPassword
          : !this.methods.appsScript
      )
        continue;
      const collision = await this.repository.account.findByIdentity(
        provider,
        input.email,
      );
      if (collision && collision.userId !== input.id)
        throw new Error("Account belongs to another user");
      const current = accounts.find(
        (account) => account.identity.providerName === provider,
      );
      if (current) {
        if (
          current.userId !== input.id ||
          current.identity.accountId !== input.email
        )
          throw new Error("Existing user identity does not match");
        continue;
      }
      if (collision) {
        accounts.push(collision);
        continue;
      }
      const accountId = `${input.id}:${provider}`;
      let identity: AppsScriptIdentity | EmailPasswordIdentity;
      if (provider === authPattern.emailPassword) {
        if (!input.password || !this.emailPassword)
          throw new Error("Password is required");
        const password = new Password(
          input.password,
          this.utilities,
          this.emailPassword.pepper,
          this.emailPassword.iterations,
        );
        identity = new EmailPasswordIdentity({
          accountId: input.email,
          password: await password.hash(accountId),
        });
      } else {
        identity = new AppsScriptIdentity({
          googleAccountAddress: input.email,
        });
      }
      accounts.push(new Account({ id: accountId, userId: input.id, identity }));
    }
    const user = new User({
      id: input.id,
      name: existing?.name ?? input.name,
      accounts,
    });
    return this.repository.user.save(user);
  }
}

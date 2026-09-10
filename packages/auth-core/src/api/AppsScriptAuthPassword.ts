import type { EmailPasswordAuthConfig } from "../authentication/EmailPasswordAuthentication";
import { authPattern } from "../AuthPattern";
import { Password } from "../domain/Password";
import { PasswordCredential } from "../domain/PasswordCredential";
import { PasswordResetToken } from "../domain/PasswordResetToken";
import { EmailPasswordIdentity } from "../identity/EmailPasswordIdentity";
import type { AppsScriptAuthRepository } from "../storage/AppsScriptAuthRepository";

export interface PasswordResetDelivery {
  send({
    email,
    token,
    expiresAt,
  }: {
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<void>;
}

export class AppsScriptAuthPassword {
  public readonly repository: AppsScriptAuthRepository;
  public readonly utilities: GoogleAppsScript.Utilities.Utilities;
  public readonly emailPassword: EmailPasswordAuthConfig;
  public readonly config: {
    expiresIn: number;
    delivery: PasswordResetDelivery;
  };

  constructor({
    repository,
    utilities,
    emailPassword,
  }: {
    repository: AppsScriptAuthRepository;
    utilities: GoogleAppsScript.Utilities.Utilities;
    emailPassword: EmailPasswordAuthConfig;
  }) {
    emailPassword.ensurePasswordResetEnabled();

    this.repository = repository;
    this.utilities = utilities;
    this.emailPassword = emailPassword;

    const passwordReset = emailPassword.passwordReset;
    if (!passwordReset) {
      throw new Error("Password reset is not enabled");
    }

    this.config = {
      expiresIn: passwordReset.expiresIn ?? 60 * 60,
      delivery: passwordReset.delivery,
    };
  }

  public async forgot({ email }: { email: string }): Promise<void> {
    const account = await this.repository.account.findByIdentity(
      authPattern.emailPassword,
      email,
    );

    if (account === null) {
      return;
    }

    if (!(account.identity instanceof EmailPasswordIdentity)) {
      throw new Error("Invalid account identity");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.expiresIn * 1000);

    const { credential, token } = PasswordCredential.generate({
      account,
      utilities: this.utilities,
      expiresAt,
    });

    await this.repository.passwordCredential.save(credential);

    await this.config.delivery.send({
      email,
      token,
      expiresAt,
    });
  }

  public async reset({
    token,
    newPassword,
  }: {
    token: string;
    newPassword: string;
  }): Promise<void> {
    const passwordResetToken = new PasswordResetToken(token);

    const credential =
      await this.repository.passwordCredential.findByResetTokenHash(
        passwordResetToken.hash(this.utilities),
      );

    if (credential === null) {
      throw new Error("Invalid password reset token");
    }

    const password = new Password(
      newPassword,
      this.utilities,
      this.emailPassword.pepper,
      this.emailPassword.iterations,
    );

    const hashedPassword = await password.hash(credential.account.id);

    const updatedCredential = credential.resetPassword({
      token,
      newPassword: hashedPassword,
      utilities: this.utilities,
      now: new Date(),
    });

    await this.repository.passwordCredential.save(updatedCredential);
  }
}

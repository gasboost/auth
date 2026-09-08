import { Authentication } from "../authentication/Authentication";
import { Session } from "../domain/Session";
import type { AppsScriptSessionStorage } from "../storage/AppsScriptSessionStorage";

export class SignIn<T> {
  private readonly sessionStorage: AppsScriptSessionStorage;
  private readonly expiresIn: number;
  private readonly utilities: GoogleAppsScript.Utilities.Utilities;
  private readonly authentication: Authentication<T>;
  constructor({
    sessionStorage,
    authentication,
    utilities,
    expiresIn,
  }: {
    sessionStorage: AppsScriptSessionStorage;
    authentication: Authentication<T>;
    utilities: GoogleAppsScript.Utilities.Utilities;
    expiresIn: number;
  }) {
    // Initialize SignIn with db, schema, and session
    this.sessionStorage = sessionStorage;
    this.authentication = authentication;
    this.utilities = utilities;
    this.expiresIn = expiresIn;
  }

  async execute(credential: T) {
    // Implement the sign-in logic using the provided authentication method
    const user = await this.authentication.verify(credential);

    const session = new Session({
      id: this.utilities.getUuid(),
      userId: user.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.expiresIn),
    });

    await this.sessionStorage.save(session);
    return { user, session };
  }
}

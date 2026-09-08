import { Session, SessionId } from "../domain/Session";
import type { Registration } from "../registration/Registration";
import type { AppsScriptSessionStorage } from "../storage/AppsScriptSessionStorage";

export class SignUp<T> {
  private readonly sessionStorage: AppsScriptSessionStorage;
  private readonly registration: Registration<T>;
  private readonly utilities: GoogleAppsScript.Utilities.Utilities;
  private readonly expiresIn: number;

  constructor({
    sessionStorage,
    registration,
    utilities,
    expiresIn,
  }: {
    sessionStorage: AppsScriptSessionStorage;
    registration: Registration<T>;
    utilities: GoogleAppsScript.Utilities.Utilities;
    expiresIn: number;
  }) {
    this.sessionStorage = sessionStorage;
    this.registration = registration;
    this.utilities = utilities;
    this.expiresIn = expiresIn;
  }

  async execute(input: T): Promise<SessionId> {
    const user = await this.registration.register(input);

    const now = new Date();

    const session = new Session({
      id: this.utilities.getUuid(),
      userId: user.id,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.expiresIn),
    });

    await this.sessionStorage.save(session);

    return session.id;
  }
}

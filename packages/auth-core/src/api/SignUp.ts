import { Session } from "../domain/Session";
import type { AfterSignInHook } from "../hooks/AuthHooks";
import type { Registration } from "../registration/Registration";
import type { AppsScriptSessionStorage } from "../storage/AppsScriptSessionStorage";
import type { SignInResult } from "./SignIn";

export type SignUpResult<THookResult = undefined> = SignInResult<THookResult>;

export class SignUp<T, THookResult = undefined> {
  private readonly afterSignIn: AfterSignInHook<THookResult> | undefined;
  private readonly sessionStorage: AppsScriptSessionStorage;
  private readonly registration: Registration<T>;
  private readonly utilities: GoogleAppsScript.Utilities.Utilities;
  private readonly expiresIn: number;

  constructor({
    sessionStorage,
    registration,
    utilities,
    expiresIn,
    afterSignIn,
  }: {
    sessionStorage: AppsScriptSessionStorage;
    registration: Registration<T>;
    utilities: GoogleAppsScript.Utilities.Utilities;
    expiresIn: number;
    afterSignIn?: AfterSignInHook<THookResult>;
  }) {
    this.sessionStorage = sessionStorage;
    this.registration = registration;
    this.utilities = utilities;
    this.expiresIn = expiresIn;
    this.afterSignIn = afterSignIn;
  }

  async execute(input: T): Promise<SignUpResult<THookResult>> {
    const user = await this.registration.register(input);

    const now = new Date();

    const session = new Session({
      id: this.utilities.getUuid(),
      userId: user.id,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.expiresIn),
    });

    await this.sessionStorage.save(session);

    if (!this.afterSignIn) {
      return { user, session } as SignUpResult<THookResult>;
    }

    try {
      const hooks = await this.afterSignIn({ user, session });
      return { user, session, hooks } as SignUpResult<THookResult>;
    } catch (error) {
      try {
        await this.sessionStorage.delete(session.id);
      } catch {
        // Preserve the original hook error. Registration remains intact.
      }
      throw error;
    }
  }
}

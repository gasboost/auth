import { Authentication } from "../authentication/Authentication";
import { Session } from "../domain/Session";
import type { User } from "../domain/User";
import type { AfterSignInContext, AfterSignInHook } from "../hooks/AuthHooks";
import type { AppsScriptSessionStorage } from "../storage/AppsScriptSessionStorage";

export type SignInResult<THookResult = undefined> = [THookResult] extends [
  undefined,
]
  ? {
      readonly user: User;
      readonly session: Session;
    }
  : {
      readonly user: User;
      readonly session: Session;
      readonly hooks: THookResult;
    };

export class SignIn<TCredential, THookResult = undefined> {
  private readonly sessionStorage: AppsScriptSessionStorage;
  private readonly expiresIn: number;
  private readonly utilities: GoogleAppsScript.Utilities.Utilities;
  private readonly authentication: Authentication<TCredential>;
  private readonly afterSignIn: AfterSignInHook<THookResult> | undefined;

  constructor({
    sessionStorage,
    authentication,
    utilities,
    expiresIn,
    afterSignIn,
  }: {
    sessionStorage: AppsScriptSessionStorage;
    authentication: Authentication<TCredential>;
    utilities: GoogleAppsScript.Utilities.Utilities;
    expiresIn: number;
    afterSignIn?: AfterSignInHook<THookResult>;
  }) {
    this.sessionStorage = sessionStorage;
    this.authentication = authentication;
    this.utilities = utilities;
    this.expiresIn = expiresIn;
    this.afterSignIn = afterSignIn;
  }

  public async execute(
    credential: TCredential,
  ): Promise<SignInResult<THookResult>> {
    const user = await this.authentication.verify(credential);

    const session = new Session({
      id: this.utilities.getUuid(),
      userId: user.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.expiresIn),
    });

    await this.sessionStorage.save(session);

    if (!this.afterSignIn) {
      return {
        user,
        session,
      } as SignInResult<THookResult>;
    }

    const context: AfterSignInContext = {
      user,
      session,
    };

    try {
      const hooks = await this.afterSignIn(context);

      return {
        user,
        session,
        hooks,
      } as SignInResult<THookResult>;
    } catch (error) {
      try {
        await this.sessionStorage.delete(session.id);
      } catch {
        // Preserve the original hook error.
      }
      throw error;
    }
  }
}

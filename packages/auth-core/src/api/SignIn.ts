import {
  resolveUser,
  type UserDataProvider,
  type AuthenticatedUser,
} from "./UserData";
import { Authentication } from "../authentication/Authentication";
import { Session } from "../domain/Session";
import type { AfterSignInContext, AfterSignInHook } from "../hooks/AuthHooks";
import type { AppsScriptSessionStorage } from "../storage/AppsScriptSessionStorage";

export type SignInResult<THookResult = undefined, TData = never> = [
  THookResult,
] extends [undefined]
  ? {
      readonly user: AuthenticatedUser<TData>;
      readonly session: Session;
    }
  : {
      readonly user: AuthenticatedUser<TData>;
      readonly session: Session;
      readonly hooks: THookResult;
    };

export class SignIn<TCredential, THookResult = undefined, TData = never> {
  private readonly sessionStorage: AppsScriptSessionStorage;
  private readonly expiresIn: number;
  private readonly utilities: GoogleAppsScript.Utilities.Utilities;
  private readonly authentication: Authentication<TCredential>;
  private readonly afterSignIn: AfterSignInHook<THookResult> | undefined;

  private readonly userData: UserDataProvider<TData> | undefined;

  constructor({
    sessionStorage,
    authentication,
    utilities,
    expiresIn,
    afterSignIn,
    userData,
  }: {
    sessionStorage: AppsScriptSessionStorage;
    authentication: Authentication<TCredential>;
    utilities: GoogleAppsScript.Utilities.Utilities;
    expiresIn: number;
    afterSignIn?: AfterSignInHook<THookResult>;
    userData?: UserDataProvider<TData>;
  }) {
    this.sessionStorage = sessionStorage;
    this.authentication = authentication;
    this.utilities = utilities;
    this.expiresIn = expiresIn;
    this.afterSignIn = afterSignIn;
    this.userData = userData;
  }

  public async execute(
    credential: TCredential,
  ): Promise<SignInResult<THookResult, TData>> {
    const baseUser = await this.authentication.verify(credential);
    const user = await resolveUser(baseUser, this.userData);

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
      } as SignInResult<THookResult, TData>;
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
      } as SignInResult<THookResult, TData>;
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

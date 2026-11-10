import { UserDTO } from "../dto/UserDTO";
import { SessionDTO } from "../dto/SessionDTO";
import { resolveUser, type UserDataProvider } from "./UserData";
import { Session } from "../domain/Session";
import type { AfterSignInHook } from "../hooks/AuthHooks";
import type { Registration } from "../registration/Registration";
import type { AppsScriptSessionStorage } from "../storage/AppsScriptSessionStorage";
import type { SignInResult } from "./SignIn";

export type SignUpResult<THookResult = undefined, TData = never> = SignInResult<
  THookResult,
  TData
>;

export class SignUp<T, THookResult = undefined, TData = never> {
  private readonly afterSignIn: AfterSignInHook<THookResult> | undefined;
  private readonly sessionStorage: AppsScriptSessionStorage;
  private readonly registration: Registration<T>;
  private readonly utilities: GoogleAppsScript.Utilities.Utilities;
  private readonly expiresIn: number;

  private readonly userData: UserDataProvider<TData> | undefined;

  constructor({
    sessionStorage,
    registration,
    utilities,
    expiresIn,
    afterSignIn,
    userData,
  }: {
    sessionStorage: AppsScriptSessionStorage;
    registration: Registration<T>;
    utilities: GoogleAppsScript.Utilities.Utilities;
    expiresIn: number;
    afterSignIn?: AfterSignInHook<THookResult>;
    userData?: UserDataProvider<TData>;
  }) {
    this.sessionStorage = sessionStorage;
    this.registration = registration;
    this.utilities = utilities;
    this.expiresIn = expiresIn;
    this.afterSignIn = afterSignIn;
    this.userData = userData;
  }

  async execute(input: T): Promise<SignUpResult<THookResult, TData>> {
    const baseUser = await this.registration.register(input);
    const user = await resolveUser(baseUser, this.userData);

    const now = new Date();

    const session = new Session({
      id: this.utilities.getUuid(),
      userId: user.id,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.expiresIn),
    });

    await this.sessionStorage.save(session);

    if (!this.afterSignIn) {
      return {
        user: new UserDTO<TData>(user),
        session: new SessionDTO(session),
      } as SignUpResult<THookResult, TData>;
    }

    try {
      const hooks = await this.afterSignIn({ user, session });
      return {
        user: new UserDTO<TData>(user),
        session: new SessionDTO(session),
        hooks,
      } as SignUpResult<THookResult, TData>;
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

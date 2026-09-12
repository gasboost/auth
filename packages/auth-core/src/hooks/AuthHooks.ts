import type { Session } from "../domain/Session";
import type { User } from "../domain/User";

export type AfterSignInContext = {
  readonly user: User;
  readonly session: Session;
};

export type AfterSignInHook<TResult> = (
  context: AfterSignInContext,
) => TResult | Promise<TResult>;

export type AuthHooks<TResult = undefined> = {
  readonly afterSignIn?: AfterSignInHook<TResult>;
};

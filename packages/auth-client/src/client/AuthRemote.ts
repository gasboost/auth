import type { AuthSession } from "./types";

/**
 * Transport-independent operations. Tokens are explicit here so a custom remote
 * need not depend on shared storage or an RPC metadata pipeline.
 */
export interface AuthRemote<
  TSession extends AuthSession = AuthSession,
  TSignInInput = unknown,
  TSignUpInput = unknown,
  TSignInSession extends AuthSession = TSession,
  TSignUpSession extends AuthSession = TSession,
> {
  signIn(input: TSignInInput): Promise<TSignInSession>;
  signUp(input: TSignUpInput): Promise<TSignUpSession>;
  signOut(token: string): Promise<void>;
  getSession(token: string): Promise<TSession | null>;
}

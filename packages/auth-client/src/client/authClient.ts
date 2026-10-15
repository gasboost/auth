import { authCore } from "../core/authCore";
import type { AuthStorage } from "../core/AuthStorage";
import type { AuthRemote } from "./AuthRemote";
import type { AuthSession } from "./types";

export function authClient<
  TSession extends AuthSession,
  TSignInInput,
  TSignUpInput,
  TSignInSession extends AuthSession = TSession,
  TSignUpSession extends AuthSession = TSession,
>({
  remote,
  storage,
}: {
  remote: AuthRemote<
    TSession,
    TSignInInput,
    TSignUpInput,
    TSignInSession,
    TSignUpSession
  >;
  storage: AuthStorage;
}) {
  const core = authCore<TSession | TSignInSession | TSignUpSession>({
    storage,
  });
  let revision = 0;

  async function authenticate<TResult extends AuthSession>(
    operation: () => Promise<TResult>,
    commit: (session: TResult) => void,
  ): Promise<TResult> {
    const current = ++revision;
    const session = await operation();
    if (current === revision) commit(session);
    return session;
  }

  return {
    getState: core.getState,
    getSession: core.getSession,
    getUser: core.getUser,
    getToken: core.getToken,
    subscribe: core.subscribe,
    signIn(input: TSignInInput): Promise<TSignInSession> {
      return authenticate(() => remote.signIn(input), core.setSession);
    },
    signUp(input: TSignUpInput): Promise<TSignUpSession> {
      return authenticate(() => remote.signUp(input), core.setSession);
    },
    async signOut(): Promise<void> {
      const current = ++revision;
      const token = storage.get();
      if (token !== null && token.trim().length > 0)
        await remote.signOut(token);
      // A newer operation or another owner of this storage supersedes this one.
      if (current === revision && storage.get() === token) {
        core.setSession(null);
      }
    },
    async restoreSession(): Promise<TSession | null> {
      const current = ++revision;
      const token = storage.get();
      if (token === null || token.trim().length === 0) {
        core.setSession(null);
        return null;
      }
      const session = await remote.getSession(token);
      if (current === revision && storage.get() === token) {
        core.setSession(session);
      }
      return session;
    },
  };
}

export type AuthClient<
  TSession extends AuthSession = AuthSession,
  TSignInInput = unknown,
  TSignUpInput = unknown,
  TSignInSession extends AuthSession = TSession,
  TSignUpSession extends AuthSession = TSession,
> = ReturnType<
  typeof authClient<
    TSession,
    TSignInInput,
    TSignUpInput,
    TSignInSession,
    TSignUpSession
  >
>;

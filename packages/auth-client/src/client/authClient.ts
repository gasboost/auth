import { authCore } from "../core/authCore";
import type { AuthStorage } from "../core/AuthStorage";
import type { AuthRemote } from "./AuthRemote";
import type { AuthSession } from "./types";

export type AuthClientHooks<
  TResult extends AuthSession,
  TSession extends AuthSession = TResult,
> = {
  afterSignIn?: (result: TResult) => void | Promise<void>;
  sync?: (session: TSession | null) => boolean | Promise<boolean>;
  afterSignOut?: () => void | Promise<void>;
};

export function authClient<
  TSession extends AuthSession,
  TSignInInput,
  TSignUpInput,
  TSignInSession extends AuthSession = TSession,
  TSignUpSession extends AuthSession = TSession,
>({
  remote,
  storage,
  hooks,
}: {
  remote: AuthRemote<
    TSession,
    TSignInInput,
    TSignUpInput,
    TSignInSession,
    TSignUpSession
  >;
  storage: AuthStorage;
  hooks?: AuthClientHooks<TSignInSession | TSignUpSession, TSession>;
}) {
  const core = authCore<TSession | TSignInSession | TSignUpSession>({
    storage,
  });
  let revision = 0;

  async function restoreSession(current: number): Promise<TSession | null> {
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
  }

  async function authenticate<TResult extends TSignInSession | TSignUpSession>(
    operation: () => Promise<TResult>,
    commit: (session: TResult) => void,
  ): Promise<TResult> {
    const current = ++revision;
    const session = await operation();
    if (current !== revision) return session;
    if (hooks?.afterSignIn) {
      try {
        await hooks.afterSignIn(session);
      } catch (error) {
        try {
          await remote.signOut(session.token);
        } catch {
          // Preserve the consumer hook error even if revocation fails.
        }
        throw error;
      }
    }
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
        if (current === revision) await hooks?.afterSignOut?.();
      }
    },
    restoreSession(): Promise<TSession | null> {
      return restoreSession(++revision);
    },
    async sync(): Promise<{ session: TSession | null; synchronized: boolean }> {
      const current = ++revision;
      const session = await restoreSession(current);
      const isCurrent = () =>
        current === revision && storage.get() === (session?.token ?? null);
      // Do not start external work for a superseded restoration.
      if (!isCurrent()) return { session, synchronized: false };
      const synchronized = hooks?.sync ? await hooks.sync(session) : true;
      return { session, synchronized: isCurrent() && synchronized };
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

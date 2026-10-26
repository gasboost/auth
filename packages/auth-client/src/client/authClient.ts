import { authCore } from "../core/authCore";
import type { AuthStorage } from "../core/AuthStorage";
import type { AuthRemote } from "./AuthRemote";
import type { AuthSession } from "./types";

/** IDs must be normalized to application User IDs by the consumer. */
export interface ExternalAuth {
  getUserId(): Promise<string | null>;
  signIn(userId: string): Promise<void>;
  signOut(): Promise<void>;
}

export type AuthClientHooks<TResult extends AuthSession> = {
  afterSignIn?: (result: TResult) => void | Promise<void>;
  afterSignOut?: () => void | Promise<void>;
};

export type ExternalAuthOptions<TSession extends AuthSession> =
  | { externalAuth?: undefined; getUserId?: (session: TSession) => string }
  | { externalAuth: ExternalAuth; getUserId: (session: TSession) => string };

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
  externalAuth,
  getUserId,
}: {
  remote: AuthRemote<
    TSession,
    TSignInInput,
    TSignUpInput,
    TSignInSession,
    TSignUpSession
  >;
  storage: AuthStorage;
  hooks?: AuthClientHooks<TSignInSession | TSignUpSession>;
} & ExternalAuthOptions<TSession | TSignInSession | TSignUpSession>) {
  const core = authCore<TSession | TSignInSession | TSignUpSession>({
    storage,
  });
  let revision = 0;
  let comparisonRevision = 0;

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
        if (current === revision && storage.get() === null) {
          await externalAuth?.signOut();
          if (current === revision && storage.get() === null)
            await hooks?.afterSignOut?.();
        }
      }
    },
    restoreSession(): Promise<TSession | null> {
      return restoreSession(++revision);
    },
    async isSynced(): Promise<boolean> {
      const comparison = ++comparisonRevision;
      const current = revision;
      const token = storage.get();
      const session = core.getSession();
      const expected = session === null ? null : getUserId?.(session);
      const actual = externalAuth ? await externalAuth.getUserId() : expected;
      return (
        comparison === comparisonRevision &&
        current === revision &&
        storage.get() === token &&
        actual === expected
      );
    },
    async sync(): Promise<{ session: TSession | null; synchronized: boolean }> {
      const current = ++revision;
      const comparison = ++comparisonRevision;
      const session = await restoreSession(current);
      const isCurrent = () =>
        current === revision &&
        comparison === comparisonRevision &&
        storage.get() === (session?.token ?? null);
      if (!isCurrent()) return { session, synchronized: false };
      if (!externalAuth) return { session, synchronized: true };
      const expected = session === null ? null : getUserId(session);
      let actual = await externalAuth.getUserId();
      if (!isCurrent()) return { session, synchronized: false };
      if (actual !== expected) {
        if (expected === null) await externalAuth.signOut();
        else await externalAuth.signIn(expected);
        if (!isCurrent()) return { session, synchronized: false };
        actual = await externalAuth.getUserId();
      }
      return { session, synchronized: isCurrent() && actual === expected };
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

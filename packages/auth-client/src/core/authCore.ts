import type { AuthListener, AuthSession, AuthState } from "../client/types";
import type { AuthStorage } from "./AuthStorage";

export function authCore<TSession extends AuthSession = AuthSession>({
  storage,
}: {
  storage: AuthStorage;
}) {
  let state: AuthState<TSession> = Object.freeze({
    session: null,
    user: null,
    token: null,
    isAuthenticated: false,
  });
  const listeners = new Set<AuthListener<TSession>>();

  function setSession(session: TSession | null): void {
    if (session !== null) {
      if (
        typeof session.token !== "string" ||
        session.token.trim().length === 0
      ) {
        throw new Error(
          "Authentication must return a non-empty session token.",
        );
      }
      storage.set(session.token);
    } else {
      storage.remove();
    }
    state = Object.freeze({
      session,
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: session !== null,
    });
    // A subscriber cannot turn successful authentication into a failed operation.
    for (const listener of [...listeners]) {
      try {
        listener(state);
      } catch {
        // Keep delivering the committed state to the other subscribers.
      }
    }
  }

  return {
    getState: () => state,
    getSession: () => state.session,
    getUser: () => state.user,
    getToken: () => state.token,
    setSession,
    subscribe(listener: AuthListener<TSession>): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

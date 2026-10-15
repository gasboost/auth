/** Minimal frontend session. Remote adapters may add session data and hook results. */
export interface AuthSession<TUser = unknown> {
  readonly token: string;
  readonly user: TUser | null;
}

export interface AuthState<TSession extends AuthSession = AuthSession> {
  readonly session: TSession | null;
  readonly user: TSession["user"] | null;
  readonly token: string | null;
  readonly isAuthenticated: boolean;
}

export type AuthListener<TSession extends AuthSession> = (
  state: AuthState<TSession>,
) => void;

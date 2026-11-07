/** Stable auth failure codes, safe to import in browsers without the GAS runtime. */
export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_PASSWORD_RESET: "INVALID_PASSWORD_RESET",
  REGISTRATION_FAILED: "REGISTRATION_FAILED",
} as const;

export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export class AuthError extends Error {
  public readonly code: AuthErrorCode;

  /** message must contain only information safe to expose to the caller. */
  constructor({ code, message }: { code: AuthErrorCode; message: string }) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

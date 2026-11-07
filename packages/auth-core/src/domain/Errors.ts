import { AuthError, AUTH_ERROR_CODES } from "../errors";

export class InvalidPasswordResetError extends AuthError {
  constructor() {
    super({
      code: AUTH_ERROR_CODES.INVALID_PASSWORD_RESET,
      message: "Invalid password reset token",
    });
  }
}

export class InvalidPasswordResetError extends Error {
  constructor() {
    super("Invalid password reset token");
  }
}

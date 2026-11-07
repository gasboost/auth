import { describe, expect, expectTypeOf, it } from "vitest";
import { AuthError, AUTH_ERROR_CODES, type AuthErrorCode } from "../src/errors";
import { InvalidPasswordResetError } from "../src/domain/Errors";

describe("AuthError", () => {
  it("retains its stable code and safe message as an Error", () => {
    const error = new AuthError({
      code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
      message: "Invalid credentials",
    });
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "AuthError",
      code: "INVALID_CREDENTIALS",
      message: "Invalid credentials",
    });
    expectTypeOf(error.code).toEqualTypeOf<AuthErrorCode>();
  });

  it("keeps password reset failures compatible with their existing class", () => {
    const error = new InvalidPasswordResetError();
    expect(error).toBeInstanceOf(AuthError);
    expect(error).toMatchObject({
      code: AUTH_ERROR_CODES.INVALID_PASSWORD_RESET,
      message: "Invalid password reset token",
    });
  });
});

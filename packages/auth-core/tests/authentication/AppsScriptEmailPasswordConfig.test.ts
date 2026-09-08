import { describe, expect, it } from "vitest";

import { EmailPasswordAuthConfig } from "../../src/authentication/EmailPasswordAuthentication";

describe("EmailPasswordAuthConfig", () => {
  it("デフォルトでは無効になる", () => {
    const config = new EmailPasswordAuthConfig({
      pepper: "",
    });

    expect(config.enabled).toBe(false);
    expect(config.isSignupEnabled).toBe(true);
  });

  it("有効なのにpepperが空なら生成を拒否する", () => {
    expect(
      () =>
        new EmailPasswordAuthConfig({
          enabled: true,
          pepper: "",
        }),
    ).toThrow(
      "Pepper is required when email and password authentication is enabled",
    );
  });

  it("有効なのにpepperが空白だけなら生成を拒否する", () => {
    expect(
      () =>
        new EmailPasswordAuthConfig({
          enabled: true,
          pepper: "   ",
        }),
    ).toThrow(
      "Pepper is required when email and password authentication is enabled",
    );
  });

  it("有効でpepperがあれば生成できる", () => {
    const config = new EmailPasswordAuthConfig({
      enabled: true,
      pepper: "pepper",
    });

    expect(config.enabled).toBe(true);
    expect(config.pepper).toBe("pepper");
  });

  it("無効ならpepperが空でも生成できる", () => {
    expect(
      () =>
        new EmailPasswordAuthConfig({
          enabled: false,
          pepper: "",
        }),
    ).not.toThrow();
  });

  it("sign inが無効なら拒否する", () => {
    const config = new EmailPasswordAuthConfig({
      enabled: false,
      pepper: "",
    });

    expect(() => config.ensureSignInEnabled()).toThrow(
      "Email and password authentication is disabled",
    );
  });

  it("sign inが有効なら通過する", () => {
    const config = new EmailPasswordAuthConfig({
      enabled: true,
      pepper: "pepper",
    });

    expect(() => config.ensureSignInEnabled()).not.toThrow();
  });

  it("authenticationが無効ならsign upも拒否する", () => {
    const config = new EmailPasswordAuthConfig({
      enabled: false,
      isSignupEnabled: true,
      pepper: "",
    });

    expect(() => config.ensureSignUpEnabled()).toThrow(
      "Email and password authentication is disabled",
    );
  });

  it("sign upが無効なら拒否する", () => {
    const config = new EmailPasswordAuthConfig({
      enabled: true,
      isSignupEnabled: false,
      pepper: "pepper",
    });

    expect(() => config.ensureSignUpEnabled()).toThrow(
      "Email and password signup is disabled",
    );
  });

  it("authenticationとsign upが有効なら通過する", () => {
    const config = new EmailPasswordAuthConfig({
      enabled: true,
      isSignupEnabled: true,
      pepper: "pepper",
    });

    expect(() => config.ensureSignUpEnabled()).not.toThrow();
  });
});

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

  it("iterationsのデフォルトは300になる", () => {
    const config = new EmailPasswordAuthConfig({
      pepper: "",
    });

    expect(config.iterations).toBe(EmailPasswordAuthConfig.DEFAULT_ITERATIONS);
    expect(config.iterations).toBe(300);
  });

  it("iterationsを指定できる", () => {
    const config = new EmailPasswordAuthConfig({
      pepper: "",
      iterations: 500,
    });

    expect(config.iterations).toBe(500);
  });

  it("最大iterationsは1000になる", () => {
    expect(EmailPasswordAuthConfig.MAX_ITERATIONS).toBe(1000);
  });

  it("iterationsが1なら生成できる", () => {
    expect(
      () =>
        new EmailPasswordAuthConfig({
          pepper: "",
          iterations: 1,
        }),
    ).not.toThrow();
  });

  it("iterationsが最大値なら生成できる", () => {
    expect(
      () =>
        new EmailPasswordAuthConfig({
          pepper: "",
          iterations: EmailPasswordAuthConfig.MAX_ITERATIONS,
        }),
    ).not.toThrow();
  });

  it("iterationsが0なら拒否する", () => {
    expect(
      () =>
        new EmailPasswordAuthConfig({
          pepper: "",
          iterations: 0,
        }),
    ).toThrow("Password hash iterations must be a positive integer");
  });

  it("iterationsが負数なら拒否する", () => {
    expect(
      () =>
        new EmailPasswordAuthConfig({
          pepper: "",
          iterations: -1,
        }),
    ).toThrow("Password hash iterations must be a positive integer");
  });

  it("iterationsが小数なら拒否する", () => {
    expect(
      () =>
        new EmailPasswordAuthConfig({
          pepper: "",
          iterations: 1.5,
        }),
    ).toThrow("Password hash iterations must be a positive integer");
  });

  it("iterationsが最大値を超える場合は拒否する", () => {
    expect(
      () =>
        new EmailPasswordAuthConfig({
          pepper: "",
          iterations: EmailPasswordAuthConfig.MAX_ITERATIONS + 1,
        }),
    ).toThrow("Password hash iterations must not exceed 1000");
  });

  it("ensureIterationsWithinLimitで許容範囲を検証できる", () => {
    const config = new EmailPasswordAuthConfig({
      pepper: "",
    });

    expect(() => config.ensureIterationsWithinLimit(1)).not.toThrow();

    expect(() => config.ensureIterationsWithinLimit(500)).not.toThrow();

    expect(() => config.ensureIterationsWithinLimit(1000)).not.toThrow();
  });

  it("ensureIterationsWithinLimitで最大値超過を検出できる", () => {
    const config = new EmailPasswordAuthConfig({
      pepper: "",
    });

    expect(() => config.ensureIterationsWithinLimit(1001)).toThrow(
      "Password hash iterations must not exceed 1000",
    );
  });
});

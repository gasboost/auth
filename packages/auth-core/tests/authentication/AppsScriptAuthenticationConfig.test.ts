import { describe, expect, it } from "vitest";

import { AppsScriptAuthenticationConfig } from "../../src/authentication/AppsScriptAuthentication";

describe("AppsScriptAuthenticationConfig", () => {
  it("デフォルトでは無効になる", () => {
    const config = new AppsScriptAuthenticationConfig({});

    expect(config.enabled).toBe(false);
    expect(config.isSignupEnabled).toBe(true);
  });

  it("sign inが無効なら拒否する", () => {
    const config = new AppsScriptAuthenticationConfig({
      enabled: false,
    });

    expect(() => config.ensureSignInEnabled()).toThrow(
      "Apps Script authentication is disabled",
    );
  });

  it("sign inが有効なら通過する", () => {
    const config = new AppsScriptAuthenticationConfig({
      enabled: true,
    });

    expect(() => config.ensureSignInEnabled()).not.toThrow();
  });

  it("authenticationが無効ならsign upも拒否する", () => {
    const config = new AppsScriptAuthenticationConfig({
      enabled: false,
      isSignupEnabled: true,
    });

    expect(() => config.ensureSignUpEnabled()).toThrow(
      "Apps Script authentication is disabled",
    );
  });

  it("sign upが無効なら拒否する", () => {
    const config = new AppsScriptAuthenticationConfig({
      enabled: true,
      isSignupEnabled: false,
    });

    expect(() => config.ensureSignUpEnabled()).toThrow(
      "Apps Script signup is disabled",
    );
  });

  it("authenticationとsign upが有効なら通過する", () => {
    const config = new AppsScriptAuthenticationConfig({
      enabled: true,
      isSignupEnabled: true,
    });

    expect(() => config.ensureSignUpEnabled()).not.toThrow();
  });
});

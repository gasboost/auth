import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, it } from "vitest";

import { PasswordReset } from "../../src/domain/PasswordReset";

describe("PasswordReset", () => {
  it("有効なPasswordResetを生成してplain tokenを返す", () => {
    const utilities = new NodeUtilities();
    const expiresAt = new Date("2026-09-10T10:00:00+09:00");

    const { reset, token } = PasswordReset.create({
      accountId: "account-1",
      utilities,
      expiresAt,
    });

    expect(reset.accountId).toBe("account-1");
    expect(reset.expiresAt).toEqual(expiresAt);
    expect(reset.enabled).toBe(true);

    expect(token).toBeTruthy();
    expect(reset.tokenHash).not.toBe(token);
    expect(reset.verify(token, utilities)).toBe(true);
  });

  it("異なるtokenを拒否する", () => {
    const utilities = new NodeUtilities();

    const { reset } = PasswordReset.create({
      accountId: "account-1",
      utilities,
      expiresAt: new Date("2026-09-10T10:00:00+09:00"),
    });

    expect(reset.verify("invalid-token", utilities)).toBe(false);
  });

  it("expiresAt以前は期限切れではない", () => {
    const reset = new PasswordReset({
      id: "reset-1",
      accountId: "account-1",
      tokenHash: "hash",
      expiresAt: new Date("2026-09-10T10:00:00+09:00"),
      enabled: true,
    });

    expect(reset.isExpired(new Date("2026-09-10T09:59:59+09:00"))).toBe(false);
  });

  it("expiresAtに到達すると期限切れになる", () => {
    const reset = new PasswordReset({
      id: "reset-1",
      accountId: "account-1",
      tokenHash: "hash",
      expiresAt: new Date("2026-09-10T10:00:00+09:00"),
      enabled: true,
    });

    expect(reset.isExpired(new Date("2026-09-10T10:00:00+09:00"))).toBe(true);
  });

  it("disableすると無効化された新しいPasswordResetを返す", () => {
    const reset = new PasswordReset({
      id: "reset-1",
      accountId: "account-1",
      tokenHash: "hash",
      expiresAt: new Date("2026-09-10T10:00:00+09:00"),
      enabled: true,
    });

    const disabled = reset.disable();

    expect(disabled).not.toBe(reset);
    expect(disabled.id).toBe(reset.id);
    expect(disabled.accountId).toBe(reset.accountId);
    expect(disabled.tokenHash).toBe(reset.tokenHash);
    expect(disabled.expiresAt).toEqual(reset.expiresAt);
    expect(disabled.enabled).toBe(false);

    expect(reset.enabled).toBe(true);
  });
});

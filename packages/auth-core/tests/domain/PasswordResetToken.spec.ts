import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, it } from "vitest";

import { PasswordResetToken } from "../../src/domain/PasswordResetToken";

describe("PasswordResetToken", () => {
  it("tokenを生成できる", () => {
    const utilities = new NodeUtilities();

    const token = PasswordResetToken.generate(utilities);

    expect(token.value).toBeTruthy();
  });

  it("同じtokenは同じhashになる", () => {
    const utilities = new NodeUtilities();

    const token = new PasswordResetToken("reset-token");

    expect(token.hash(utilities)).toBe(
      new PasswordResetToken("reset-token").hash(utilities),
    );
  });

  it("異なるtokenは異なるhashになる", () => {
    const utilities = new NodeUtilities();

    expect(new PasswordResetToken("token-a").hash(utilities)).not.toBe(
      new PasswordResetToken("token-b").hash(utilities),
    );
  });

  it("hashにplain tokenをそのまま保持しない", () => {
    const utilities = new NodeUtilities();

    const token = new PasswordResetToken("reset-token");

    expect(token.hash(utilities)).not.toBe(token.value);
  });
});

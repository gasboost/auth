import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, it } from "vitest";

import { Password } from "../../src/domain/Password";
import { EmailPasswordIdentity } from "../../src/identity/EmailPasswordIdentity";

describe("EmailPasswordIdentity", () => {
  it("Account.idをsaltとしてpasswordを検証できる", async () => {
    const utilities = new NodeUtilities();

    const password = new Password("password", utilities, "pepper", 3);

    const hashed = await password.hash("account-id");

    const identity = new EmailPasswordIdentity({
      accountId: "user@example.com",
      password: hashed,
    });

    await expect(identity.verify(password, "account-id")).resolves.toBe(true);
  });
});

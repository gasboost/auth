import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, it } from "vitest";

import { HashedPassword, Password } from "../../src/domain/Password";

describe("Password", () => {
  it("同じpassword・salt・pepper・iterationsなら同じhashになる", async () => {
    const utilities = new NodeUtilities();

    const first = await new Password("password", utilities, "pepper", 3).hash(
      "salt",
    );

    const second = await new Password("password", utilities, "pepper", 3).hash(
      "salt",
    );

    expect(first.value).toBe(second.value);
  });

  it("saltが異なる場合は異なるhashになる", async () => {
    const utilities = new NodeUtilities();

    const first = await new Password("password", utilities, "pepper", 3).hash(
      "salt-1",
    );

    const second = await new Password("password", utilities, "pepper", 3).hash(
      "salt-2",
    );

    expect(first.value).not.toBe(second.value);
  });

  it("pepperが異なる場合は異なるhashになる", async () => {
    const utilities = new NodeUtilities();

    const first = await new Password("password", utilities, "pepper-1", 3).hash(
      "salt",
    );

    const second = await new Password(
      "password",
      utilities,
      "pepper-2",
      3,
    ).hash("salt");

    expect(first.value).not.toBe(second.value);
  });

  it("iterationsが異なる場合は異なるhashになる", async () => {
    const utilities = new NodeUtilities();

    const first = await new Password("password", utilities, "pepper", 2).hash(
      "salt",
    );

    const second = await new Password("password", utilities, "pepper", 3).hash(
      "salt",
    );

    expect(first.value).not.toBe(second.value);
  });

  it("HashedPasswordはhash値だけを保持する", async () => {
    const utilities = new NodeUtilities();

    const hashed = await new Password("password", utilities, "pepper", 3).hash(
      "account-id",
    );

    expect(hashed.value).toBeTruthy();
    expect(Object.keys(hashed)).toEqual(["value"]);
  });

  it("hashにはsaltを明示的に指定する", async () => {
    const utilities = new NodeUtilities();

    const password = new Password("password", utilities, "pepper", 3);

    const first = await password.hash("account-1");
    const second = await password.hash("account-2");

    expect(first.value).not.toBe(second.value);
  });

  it("正しいpasswordならverifyに成功する", async () => {
    const utilities = new NodeUtilities();

    const hashed = await new Password("password", utilities, "pepper", 3).hash(
      "account-id",
    );

    const result = await hashed.verify(
      new Password("password", utilities, "pepper", 3),
      "account-id",
    );

    expect(result).toBe(true);
  });

  it("異なるpasswordならverifyに失敗する", async () => {
    const utilities = new NodeUtilities();

    const hashed = await new Password(
      "correct-password",
      utilities,
      "pepper",
      3,
    ).hash("account-id");

    const result = await hashed.verify(
      new Password("wrong-password", utilities, "pepper", 3),
      "account-id",
    );

    expect(result).toBe(false);
  });

  it("異なるpepperならverifyに失敗する", async () => {
    const utilities = new NodeUtilities();

    const hashed = await new Password(
      "password",
      utilities,
      "correct-pepper",
      3,
    ).hash("account-id");

    const result = await hashed.verify(
      new Password("password", utilities, "wrong-pepper", 3),
      "account-id",
    );

    expect(result).toBe(false);
  });

  it("異なるsaltならverifyに失敗する", async () => {
    const utilities = new NodeUtilities();

    const hashed = await new Password("password", utilities, "pepper", 3).hash(
      "account-1",
    );

    const result = await hashed.verify(
      new Password("password", utilities, "pepper", 3),
      "account-2",
    );

    expect(result).toBe(false);
  });

  it("異なるiterationsならverifyに失敗する", async () => {
    const utilities = new NodeUtilities();

    const hashed = await new Password("password", utilities, "pepper", 3).hash(
      "account-id",
    );

    const result = await hashed.verify(
      new Password("password", utilities, "pepper", 4),
      "account-id",
    );

    expect(result).toBe(false);
  });

  it("HashedPasswordは保存済みhash値だけから復元して検証できる", async () => {
    const utilities = new NodeUtilities();

    const original = await new Password(
      "password",
      utilities,
      "pepper",
      3,
    ).hash("account-id");

    const restored = new HashedPassword({
      value: original.value,
    });

    await expect(
      restored.verify(
        new Password("password", utilities, "pepper", 3),
        "account-id",
      ),
    ).resolves.toBe(true);
  });
});

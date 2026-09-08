import { NodeUtilities } from "@gasboost/fake-node";
import { describe, expect, it } from "vitest";

import { HashedPassword, Password } from "../../src/domain/Password";

describe("Password", () => {
  it("同じpassword・salt・pepper・iterationsなら同じhashになる", async () => {
    const utilities = new NodeUtilities();

    const first = await new Password("password", utilities, "pepper").hash({
      salt: "salt",
      iterations: 3,
    });

    const second = await new Password("password", utilities, "pepper").hash({
      salt: "salt",
      iterations: 3,
    });

    expect(first.value).toBe(second.value);
  });

  it("saltが異なる場合は異なるhashになる", async () => {
    const utilities = new NodeUtilities();

    const first = await new Password("password", utilities, "pepper").hash({
      salt: "salt-1",
      iterations: 3,
    });

    const second = await new Password("password", utilities, "pepper").hash({
      salt: "salt-2",
      iterations: 3,
    });

    expect(first.value).not.toBe(second.value);
  });

  it("pepperが異なる場合は異なるhashになる", async () => {
    const utilities = new NodeUtilities();

    const first = await new Password("password", utilities, "pepper-1").hash({
      salt: "salt",
      iterations: 3,
    });

    const second = await new Password("password", utilities, "pepper-2").hash({
      salt: "salt",
      iterations: 3,
    });

    expect(first.value).not.toBe(second.value);
  });

  it("hashにsaltとiterationsを保持する", async () => {
    const utilities = new NodeUtilities();

    const hashed = await new Password("password", utilities, "pepper").hash({
      salt: "salt",
      iterations: 7,
    });

    expect(hashed.salt).toBe("salt");
    expect(hashed.iterations).toBe(7);
  });

  it("saltを指定しない場合はUUIDをsaltとして生成する", async () => {
    const utilities = new NodeUtilities();

    const hashed = await new Password("password", utilities, "pepper").hash({
      iterations: 3,
    });

    expect(hashed.salt).toBeTruthy();
    expect(hashed.salt.length).toBeGreaterThan(0);
  });

  it("正しいpasswordならverifyに成功する", async () => {
    const utilities = new NodeUtilities();

    const hashed = await new Password("password", utilities, "pepper").hash({
      salt: "salt",
      iterations: 3,
    });

    const result = await hashed.verify(
      new Password("password", utilities, "pepper"),
    );

    expect(result).toBe(true);
  });

  it("異なるpasswordならverifyに失敗する", async () => {
    const utilities = new NodeUtilities();

    const hashed = await new Password(
      "correct-password",
      utilities,
      "pepper",
    ).hash({
      salt: "salt",
      iterations: 3,
    });

    const result = await hashed.verify(
      new Password("wrong-password", utilities, "pepper"),
    );

    expect(result).toBe(false);
  });

  it("異なるpepperならverifyに失敗する", async () => {
    const utilities = new NodeUtilities();

    const hashed = await new Password(
      "password",
      utilities,
      "correct-pepper",
    ).hash({
      salt: "salt",
      iterations: 3,
    });

    const result = await hashed.verify(
      new Password("password", utilities, "wrong-pepper"),
    );

    expect(result).toBe(false);
  });

  it("HashedPasswordは保存済みhashを検証できる", async () => {
    const utilities = new NodeUtilities();

    const original = await new Password("password", utilities, "pepper").hash({
      salt: "salt",
      iterations: 3,
    });

    const restored = new HashedPassword({
      value: original.value,
      salt: original.salt,
      iterations: original.iterations,
    });

    await expect(
      restored.verify(new Password("password", utilities, "pepper")),
    ).resolves.toBe(true);
  });
});

import { describe, expect, expectTypeOf, it } from "vitest";
import { User } from "../../src/domain/User";
import { resolveUser } from "../../src/api/UserData";

describe("resolveUser", () => {
  const user = new User({ id: "user-1", name: "Taro", accounts: [] });

  it("preserves the original user and type without a provider", async () => {
    const result = await resolveUser<never>(user);
    expect(result).toBe(user);
    expectTypeOf(result).toEqualTypeOf<User>();
    // @ts-expect-error data requires a provider
    void result.data;
  });

  it("adds data to a fresh User while preserving domain methods", async () => {
    const result = await resolveUser(user, ({ user: base }) => ({
      id: base.id,
    }));
    expect(result).not.toBe(user);
    expect(result).toBeInstanceOf(User);
    expect(result.account("appsScript")).toBeNull();
    expect(result.data.id).toBe(user.id);
    expect(user).not.toHaveProperty("data");
    expectTypeOf(result.data.id).toEqualTypeOf<string>();
  });

  it("retains explicitly undefined callback results as data", async () => {
    const result = await resolveUser(user, async () => undefined);
    expect(result).toHaveProperty("data", undefined);
    expectTypeOf(result.data).toEqualTypeOf<undefined>();
  });
});

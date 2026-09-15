import { AppsScript, type InferAppsScript } from "@gasboost/app";
import { describe, expectTypeOf, it } from "vitest";

import type { AuthenticatedInput } from "../src/AuthenticatedInput";

const _app = new AppsScript()
  .call("getProfile", (_input: AuthenticatedInput) => {
    return {
      id: "user-1",
    };
  })
  .call(
    "updateProfile",
    (
      input: AuthenticatedInput<{
        name: string;
      }>,
    ) => {
      return {
        name: input.name,
      };
    },
  )
  .call("signIn", (input: { email: string; password: string }) => {
    return {
      email: input.email,
    };
  });

type AppType = InferAppsScript<typeof _app>;

describe("AuthenticatedInput", () => {
  it("tokenのみを必須にできる", () => {
    type Input = AppType["getProfile"]["input"];

    const input: Input = {
      token: "session-1",
    };

    expectTypeOf(input.token).toEqualTypeOf<string>();

    // @ts-expect-error authenticated RPCにはtokenが必要
    const missingToken: Input = {};

    const invalidToken: Input = {
      // @ts-expect-error tokenはstringでなければならない
      token: 123,
    };

    void missingToken;
    void invalidToken;
  });

  it("任意のobject inputにtokenを追加する", () => {
    type Input = AppType["updateProfile"]["input"];

    const input: Input = {
      token: "session-1",
      name: "Taro",
    };

    expectTypeOf(input.token).toEqualTypeOf<string>();
    expectTypeOf(input.name).toEqualTypeOf<string>();

    // @ts-expect-error tokenは必須
    const missingToken: Input = {
      name: "Taro",
    };

    // @ts-expect-error 元のinputも必須
    const missingName: Input = {
      token: "session-1",
    };

    void missingToken;
    void missingName;
  });

  it("公開RPCにはtokenを要求しない", () => {
    type Input = AppType["signIn"]["input"];

    const input: Input = {
      email: "user@example.com",
      password: "password",
    };

    expectTypeOf(input.email).toEqualTypeOf<string>();
    expectTypeOf(input.password).toEqualTypeOf<string>();

    // @ts-expect-error emailは必須
    const missingEmail: Input = {
      password: "password",
    };

    void missingEmail;
  });
});

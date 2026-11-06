import { appsScriptClient } from "@gasboost/client";
import { createAuthContext } from "@gasboost/react";
import { expectTypeOf } from "vitest";
import type {
  SyncUserDataApp,
  AsyncUserDataApp,
} from "../../auth-app/tests/consumer/user-data.type-test";
import { memoryAuthStorage } from "../src";
import { appsScriptAuth } from "../src/appsscript";

function syncConsumer() {
  const { client } = appsScriptClient<SyncUserDataApp>({});
  const auth = appsScriptAuth({ client, storage: memoryAuthStorage() });
  const { useAuth } = createAuthContext(auth);
  void useAuth;
  type Context = ReturnType<typeof useAuth>;
  expectTypeOf<
    NonNullable<Context["user"]>["data"]["permissions"]
  >().toEqualTypeOf<string[]>();
  async function results() {
    const values = [
      await auth.signIn({ email: "user", password: "password" }),
      await auth.signUp({ name: "User", email: "user", password: "password" }),
      await auth.signInAppsScript(),
      await auth.signUpAppsScript({ name: "User" }),
    ];
    for (const value of values)
      expectTypeOf(value.user.data.permissions).toEqualTypeOf<string[]>();
    const restored = await auth.restoreSession();
    expectTypeOf(restored?.user.data.permissions).toEqualTypeOf<
      string[] | undefined
    >();
    // @ts-expect-error permissions are inferred as strings
    const invalid: number = restored!.user.data.permissions[0]!;
    void invalid;
  }
  void results;
}
function asyncConsumer() {
  const { client } = appsScriptClient<AsyncUserDataApp>({});
  const auth = appsScriptAuth({ client, storage: memoryAuthStorage() });
  const { useAuth } = createAuthContext(auth);
  void useAuth;
  type Context = ReturnType<typeof useAuth>;
  expectTypeOf<
    NonNullable<Context["user"]>["data"]["permissions"]
  >().toEqualTypeOf<string[]>();
  async function results() {
    const values = [
      await auth.signIn({ email: "user", password: "password" }),
      await auth.signUp({ name: "User", email: "user", password: "password" }),
      await auth.signInAppsScript(),
      await auth.signUpAppsScript({ name: "User" }),
    ];
    for (const value of values)
      expectTypeOf(value.user.data.permissions).toEqualTypeOf<string[]>();
    const restored = await auth.restoreSession();
    expectTypeOf(restored?.user.data.permissions).toEqualTypeOf<
      string[] | undefined
    >();
    // @ts-expect-error permissions are inferred as strings
    const invalid: number = restored!.user.data.permissions[0]!;
    void invalid;
  }
  void results;
}
void syncConsumer;
void asyncConsumer;

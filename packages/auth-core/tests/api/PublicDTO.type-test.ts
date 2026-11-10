import { expectTypeOf } from "vitest";
import {
  AppsScriptAuth,
  type AccountDTO,
  type SessionDTO,
  type UserDTO,
} from "../../src";

declare const config: Pick<
  ConstructorParameters<typeof AppsScriptAuth>[0],
  "repository" | "runtime" | "session"
>;
const auth = new AppsScriptAuth({
  ...config,
  user: { data: async ({ user }) => ({ permissions: ["read"], id: user.id }) },
  hooks: {
    afterSignIn: ({ user, session }) => {
      void user.account("emailPassword");
      void session.isExpired(new Date());
      return { customToken: "token" };
    },
  },
});
async function consumer() {
  const input = { name: "Taro", email: "user@example.com", password: "secret" };
  for (const result of [
    await auth.signUp.email(input),
    await auth.signUp.appsScript(input),
    await auth.signIn.email(input),
    await auth.signIn.appsScript({}),
  ]) {
    expectTypeOf(result.user).toEqualTypeOf<
      UserDTO<{ permissions: string[]; id: string }>
    >();
    expectTypeOf(result.session).toEqualTypeOf<SessionDTO>();
    expectTypeOf(result.hooks.customToken).toEqualTypeOf<string>();
    // @ts-expect-error Domain accounts must not be public
    void result.user.accounts;
    // @ts-expect-error Domain methods must not be public
    void result.session.isExpired;
  }
  const session = await auth.session.get("id");
  expectTypeOf(session).toEqualTypeOf<SessionDTO | null>();
  const restored = await auth.session.getWithUser("id");
  expectTypeOf(restored?.user.data.permissions).toEqualTypeOf<
    string[] | undefined
  >();
  // @ts-expect-error restored users do not expose accounts
  void restored?.user.accounts;
  for (const user of [
    await auth.registration.email(input),
    await auth.registration.appsScript(input),
  ]) {
    expectTypeOf(user).toEqualTypeOf<UserDTO>();
    // @ts-expect-error Registration returns a DTO
    void user.accounts;
  }
  const account = await auth.account.add("id", {
    provider: "appsScript",
    email: input.email,
  });
  expectTypeOf(account).toEqualTypeOf<AccountDTO>();
  // @ts-expect-error Identity is private
  void account.identity;
  const plain = new AppsScriptAuth(config);
  const result = await plain.signIn.appsScript({});
  expectTypeOf(result.user).toEqualTypeOf<UserDTO>();
  // @ts-expect-error Hook results require a hook
  void result.hooks;
}
void consumer;

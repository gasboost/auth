import { appsScriptClient } from "@gasboost/client";

import type { AppType as EnabledApp } from "../../auth-app/tests/consumer/backend/passwordreset-enabled";
import type { AppType as DisabledApp } from "../../auth-app/tests/consumer/backend/passwordreset-disabled";
import { memoryAuthStorage, type AuthStorage } from "../src";
import { appsScriptAuth, authMetadataProvider } from "../src/appsscript";

function enabledConsumer() {
  const storage: AuthStorage = memoryAuthStorage();
  const { client } = appsScriptClient<EnabledApp>({
    metadataProviders: [authMetadataProvider(storage)],
  });
  const auth = appsScriptAuth({ client, storage });

  void auth.signIn({ email: "user", password: "password" });
  void auth.signUp({ name: "Taro", email: "user", password: "password" });
  void auth.signInAppsScript();
  void auth.signUpAppsScript({ name: "Taro" });
  void auth.signOut();
  void auth.restoreSession();
  void auth.sync();
  void auth.isSynced();
  void client.forgotPassword({ email: "user" });
  void client.resetPassword({ token: "token", newPassword: "password" });

  // @ts-expect-error credentials retain the server's required password
  void auth.signIn({ email: "user" });
  // @ts-expect-error registration retains the server's required name
  void auth.signUp({ email: "user", password: "password" });
  // @ts-expect-error Apps Script registration requires a name
  void auth.signUpAppsScript({});
  // @ts-expect-error signOut obtains the token from the shared storage
  void auth.signOut({ token: "token" });

  async function noHooks() {
    const result = await auth.signIn({ email: "user", password: "password" });
    const name: string = result.user.name;
    // @ts-expect-error this server has no afterSignIn hook result
    void result.hooks;
    return name;
  }
  void noHooks;
}

function disabledConsumer() {
  const storage = memoryAuthStorage();
  const { client } = appsScriptClient<DisabledApp>({
    metadataProviders: [authMetadataProvider(storage)],
  });
  appsScriptAuth({ client, storage });
  // @ts-expect-error password reset RPCs only exist on enabled servers
  void client.forgotPassword({ email: "user" });
}

void enabledConsumer;
void disabledConsumer;

function hookConsumer() {
  const { client } = appsScriptClient<
    import("../../auth-app/tests/consumer/hooks.type-test").HookApp
  >({});
  const auth = appsScriptAuth({
    client,
    storage: memoryAuthStorage(),
    hooks: {
      afterSignIn: async ({ hooks, token, user }) => {
        const customToken: string = hooks.customToken;
        const sessionToken: string = token;
        const name: string = user.name;
        // @ts-expect-error inferred hook result is string
        const invalid: number = hooks.customToken;
        void [customToken, sessionToken, name, invalid];
      },
      afterSignOut: async () => {},
    },
    getUserId: (result) => {
      const userId: string = result.session.userId;
      // @ts-expect-error RPC userId is a string
      const invalid: number = result.session.userId;
      void invalid;
      return userId;
    },
    externalAuth: {
      getUserId: async () => null,
      signIn: async (userId) => {
        const id: string = userId;
        void id;
      },
      signOut: async () => {},
    },
  });
  async function results() {
    const signedIn = await auth.signIn({ email: "user", password: "password" });
    const signedUp = await auth.signUp({
      name: "Taro",
      email: "user",
      password: "password",
    });
    const appsScript = await auth.signUpAppsScript({ name: "Taro" });
    const tokens: string[] = [
      signedIn.hooks.customToken,
      signedUp.hooks.customToken,
      appsScript.hooks.customToken,
    ];
    const synchronized = await auth.sync();
    const success: boolean = synchronized.synchronized;
    const userId: string | undefined = synchronized.session?.session.userId;
    void [success, userId];
    return tokens;
  }
  // @ts-expect-error externalAuth requires a typed ID extractor
  appsScriptAuth({
    client,
    storage: memoryAuthStorage(),
    externalAuth: {
      getUserId: async () => null,
      signIn: async () => {},
      signOut: async () => {},
    },
  });
  void results;
}
void hookConsumer;

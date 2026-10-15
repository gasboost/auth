import { authClient } from "../client/authClient";
import type { AuthStorage } from "../core/AuthStorage";
import {
  appsScriptAuthRemote,
  type AppsScriptAuthRpc,
} from "./AppsScriptAuthRemote";

export function appsScriptAuth<TClient extends AppsScriptAuthRpc>({
  client,
  storage,
}: {
  client: TClient;
  storage: AuthStorage;
}) {
  const auth = authClient({
    remote: appsScriptAuthRemote({ client }),
    storage,
  });
  return {
    ...auth,
    signIn: (input: Parameters<TClient["signInEmail"]>[0]) =>
      auth.signIn({ provider: "email", input }),
    signInAppsScript: () => auth.signIn({ provider: "appsScript", input: {} }),
    signUp: (input: Parameters<TClient["signUpEmail"]>[0]) =>
      auth.signUp({ provider: "email", input }),
    signUpAppsScript: (input: Parameters<TClient["signUpAppsScript"]>[0]) =>
      auth.signUp({ provider: "appsScript", input }),
  };
}

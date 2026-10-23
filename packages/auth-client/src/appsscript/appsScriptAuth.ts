import {
  authClient,
  type AuthClientHooks,
  type ExternalAuthOptions,
} from "../client/authClient";
import type { AuthStorage } from "../core/AuthStorage";
import {
  appsScriptAuthRemote,
  type AppsScriptAuthRpc,
} from "./AppsScriptAuthRemote";

type RemoteSession<TClient extends AppsScriptAuthRpc> = NonNullable<
  Awaited<
    ReturnType<ReturnType<typeof appsScriptAuthRemote<TClient>>["getSession"]>
  >
>;
type SignInResult<TClient extends AppsScriptAuthRpc> = {
  [
    K in "signInEmail" | "signInAppsScript" | "signUpEmail" | "signUpAppsScript"
  ]: Awaited<ReturnType<TClient[K]>> & { token: string };
}["signInEmail" | "signInAppsScript" | "signUpEmail" | "signUpAppsScript"];

export function appsScriptAuth<TClient extends AppsScriptAuthRpc>({
  client,
  storage,
  hooks,
  ...externalOptions
}: {
  client: TClient;
  storage: AuthStorage;
  hooks?: AuthClientHooks<SignInResult<TClient>>;
} & ExternalAuthOptions<RemoteSession<TClient> | SignInResult<TClient>>) {
  const auth = authClient({
    remote: appsScriptAuthRemote({ client }),
    storage,
    hooks,
    ...externalOptions,
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

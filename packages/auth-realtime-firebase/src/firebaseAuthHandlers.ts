import type { AppsScriptContext } from "@gasboost/app";
import type { AuthState } from "@gasboost/auth-app";
import type { FirebaseAuthHook } from "./FirebaseAuthHook";

/** Register after authentication(auth); the input cannot choose a token subject. */
export function firebaseAuthHandlers(hook: FirebaseAuthHook) {
  return {
    issueFirebaseCustomToken: (
      _input: undefined,
      context: AppsScriptContext<AuthState, AuthState>,
    ) => hook.afterSignIn({ session: context.state.get("session") }),
  };
}

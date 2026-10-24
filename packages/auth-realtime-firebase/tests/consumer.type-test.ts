import { AppsScript, type InferAppsScript } from "@gasboost/app";
import {
  AppsScriptAuth,
  type AfterSignInHook,
  type AppsScriptAuthRepository,
} from "@gasboost/auth";
import { authentication, handlers } from "@gasboost/auth-app";
import { appsScriptClient } from "@gasboost/client";
import {
  FirebaseAuthHook,
  firebaseAuthHandlers,
  type FirebaseAuthContext,
  type FirebaseAuthHookResult,
} from "../src";

declare const repository: AppsScriptAuthRepository;
declare const runtime: ConstructorParameters<
  typeof AppsScriptAuth
>[0]["runtime"];
const hook = new FirebaseAuthHook({
  serviceAccount: { email: "service@example.com", privateKey: "server-key" },
  utilities: runtime.utilities,
  claims: (context: FirebaseAuthContext) => {
    const { session } = context;
    const id: string = session.userId;
    // @ts-expect-error claims context no longer exposes User
    const user = context.user;
    void user;
    return { userId: id };
  },
});
const compatibleHook: AfterSignInHook<FirebaseAuthHookResult> =
  hook.afterSignIn;
const auth = new AppsScriptAuth({
  repository,
  runtime,
  session: { storageType: "cache" },
  hooks: { afterSignIn: compatibleHook },
});

// @ts-expect-error authentication middleware must guarantee session before registration
new AppsScript().calls(firebaseAuthHandlers(hook));
export const app = new AppsScript()
  .calls(handlers(auth))
  .use(authentication(auth))
  .calls(firebaseAuthHandlers(hook));
export type AppType = InferAppsScript<typeof app>;
function consumer() {
  const { client } = appsScriptClient<AppType>({});
  const result: Promise<{ readonly customToken: string }> =
    client.issueFirebaseCustomToken();
  // @ts-expect-error client cannot select a User ID
  void client.issueFirebaseCustomToken({ userId: "attacker" });
  // @ts-expect-error client cannot select a Session ID
  void client.issueFirebaseCustomToken({ sessionId: "forged" });
  // @ts-expect-error client cannot provide a Session
  void client.issueFirebaseCustomToken({ session: {} });
  return result;
}
void consumer;

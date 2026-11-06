import { AppsScript, type InferAppsScript } from "@gasboost/app";
import { AppsScriptAuth } from "@gasboost/auth";
import { handlers } from "../../src";

declare const config: Pick<
  ConstructorParameters<typeof AppsScriptAuth>[0],
  "repository" | "runtime" | "session"
>;
const syncAuth = new AppsScriptAuth({
  ...config,
  user: {
    data: ({ user }) => ({ permissions: ["staff:read"], employeeId: user.id }),
  },
});
const asyncAuth = new AppsScriptAuth({
  ...config,
  hooks: { afterSignIn: async () => ({ customToken: "token" }) },
  user: {
    data: async ({ user }) => ({
      permissions: ["staff:read"],
      employeeId: user.id,
    }),
  },
});
const syncApp = new AppsScript().calls(handlers(syncAuth));
const asyncApp = new AppsScript().calls(handlers(asyncAuth));
export type SyncUserDataApp = InferAppsScript<typeof syncApp>;
export type AsyncUserDataApp = InferAppsScript<typeof asyncApp>;
void syncApp;
void asyncApp;

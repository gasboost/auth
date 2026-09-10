import { AppsScript, type InferAppsScript } from "@gasboost/app";
import { AppsScriptAuth } from "../../../src/AppsScriptAuth";
import type { AppsScriptAuthRepository } from "../../../src/storage/AppsScriptAuthRepository";

declare const repository: AppsScriptAuthRepository;
declare const runtime: ConstructorParameters<
  typeof AppsScriptAuth
>[0]["runtime"];

const auth = new AppsScriptAuth({
  repository,
  runtime,
  session: {
    storageType: "cache",
  },
  emailPassword: {
    enabled: true,
    pepper: "pepper",
    passwordReset: {
      delivery: {
        send: async () => {},
      },
    },
  },
});

export const app = new AppsScript().calls(auth.handlers);

export type AppType = InferAppsScript<typeof app>;

export default app;

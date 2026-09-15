import { AppsScript, type InferAppsScript } from "@gasboost/app";
import type { AppsScriptAuthRepository } from "@gasboost/auth";
import { AppsScriptAuth } from "@gasboost/auth";
import { handlers } from "../../../src/handlers";

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

export const app = new AppsScript().calls(handlers(auth));

export type AppType = InferAppsScript<typeof app>;

export default app;

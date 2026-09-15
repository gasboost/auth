import type { AppsScriptAuth } from "@gasboost/auth";

export type AuthSession = NonNullable<
  Awaited<ReturnType<AppsScriptAuth["session"]["get"]>>
>;

export type AuthState = {
  session: AuthSession;
};

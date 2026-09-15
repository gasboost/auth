import type { AppsScriptMiddleware } from "@gasboost/app";
import type { AppsScriptAuth } from "@gasboost/auth";

import type { AuthState } from "./AuthState";

export function authentication(
  auth: Pick<AppsScriptAuth, "session">,
): AppsScriptMiddleware<Record<never, never>, AuthState> {
  return async (context, next) => {
    if (context.invocation.type !== "call") {
      return next();
    }

    const input = context.invocation.input;

    if (typeof input !== "object" || input === null || !("token" in input)) {
      return next();
    }

    const token = input.token;

    if (typeof token !== "string") {
      throw new Error("Unauthorized");
    }

    const session = await auth.session.get(token);

    if (session === null) {
      throw new Error("Unauthorized");
    }

    context.state.set("session", session);

    return next();
  };
}

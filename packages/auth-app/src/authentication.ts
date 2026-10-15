import type { AppsScriptMiddleware } from "@gasboost/app";
import type { AppsScriptAuth } from "@gasboost/auth";
import {
  AUTH_METADATA_KEY,
  isAuthMetadata,
} from "@gasboost/auth-client/metadata";

import type { AuthState } from "./AuthState";

export function authentication(
  auth: Pick<AppsScriptAuth, "session">,
): AppsScriptMiddleware<Record<never, never>, AuthState> {
  return async (context, next) => {
    if (context.invocation.type !== "call") {
      return next();
    }

    const metadata = context.invocation.metadata;
    const authMetadata =
      metadata &&
      Object.prototype.hasOwnProperty.call(metadata, AUTH_METADATA_KEY)
        ? metadata[AUTH_METADATA_KEY]
        : undefined;

    if (!isAuthMetadata(authMetadata)) {
      throw new Error("Unauthorized");
    }

    const session = await auth.session.get(authMetadata.token);

    if (session === null) {
      throw new Error("Unauthorized");
    }

    context.state.set("session", session);

    return next();
  };
}

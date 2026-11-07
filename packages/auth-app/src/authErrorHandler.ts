import { AppsScriptError, type AppsScriptMiddleware } from "@gasboost/app";
import { AuthError } from "@gasboost/auth/errors";

/** Register before the RPCs whose auth failures should be exposed. */
export function authErrorHandler(): AppsScriptMiddleware {
  return async (_context, next) => {
    try {
      return await next();
    } catch (error) {
      if (error instanceof AuthError) {
        throw new AppsScriptError({ code: error.code, message: error.message });
      }
      throw error;
    }
  };
}

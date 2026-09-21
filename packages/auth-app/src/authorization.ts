import type { AppsScriptMiddleware } from "@gasboost/app";
import type {
  AppsScriptAuthorization,
  PermissionRequirement,
  PermissionStatement,
} from "@gasboost/auth";

import type { AuthState } from "./AuthState";

type AuthorizationService<TStatement extends PermissionStatement> = Pick<
  AppsScriptAuthorization<never>,
  "can"
> & {
  can(userId: string, requirement: PermissionRequirement<TStatement>): unknown;
};

export function authorization<const TStatement extends PermissionStatement>(
  service: AuthorizationService<TStatement>,
  requirement: PermissionRequirement<TStatement>,
): AppsScriptMiddleware<AuthState, AuthState> {
  return async (context, next) => {
    const session = context.state.get("session");
    const allowed = await service.can(session.userId, requirement);

    if (!allowed) {
      throw new Error("Forbidden");
    }

    return next();
  };
}

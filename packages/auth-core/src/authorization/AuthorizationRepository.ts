import type { StoredPermissionOverride } from "./AuthorizationPolicy";

export interface AuthorizationRepository {
  readonly role: {
    findByUserId(userId: string): Promise<readonly string[]>;
    assign(userId: string, role: string): Promise<void>;
    revoke(userId: string, role: string): Promise<void>;
  };

  readonly permission: {
    findByUserId(userId: string): Promise<readonly StoredPermissionOverride[]>;
    set(
      userId: string,
      permission: string,
      effect: StoredPermissionOverride["effect"],
    ): Promise<void>;
    revoke(userId: string, permission: string): Promise<void>;
  };
}

export { AppsScriptAuth } from "./AppsScriptAuth";
export { AppsScriptAuthorization } from "./authorization/AppsScriptAuthorization";

export type { AppsScriptAuthRepository } from "./storage/AppsScriptAuthRepository";
export type { AuthorizationRepository } from "./authorization/AuthorizationRepository";
export type {
  EffectivePermissions,
  PermissionEffect,
  PermissionOf,
  PermissionRequirement,
  PermissionStatement,
  StoredPermissionOverride,
} from "./authorization/AuthorizationPolicy";

export type { AuthSchema, AuthSchemaOptions } from "./schema/AuthSchema";
export { createAuthTables } from "./schema/createAuthTables";
export type {
  AuthorizationSchema,
  AuthorizationSchemaOptions,
} from "./schema/AuthorizationSchema";
export { createAuthorizationTables } from "./schema/createAuthorizationTables";

export { authPattern, type AuthPattern } from "./AuthPattern";

export { Account } from "./domain/Account";
export { User } from "./domain/User";

export { HashedPassword, Password } from "./domain/Password";
export { PasswordCredential } from "./domain/PasswordCredential";
export { PasswordReset } from "./domain/PasswordReset";

export { AppsScriptIdentity } from "./identity/AppsScriptIdentity";
export { EmailPasswordIdentity } from "./identity/EmailPasswordIdentity";

export type {
  AfterSignInContext,
  AfterSignInHook,
  AuthHooks,
} from "./hooks/AuthHooks";

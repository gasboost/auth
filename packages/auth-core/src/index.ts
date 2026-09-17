export { AppsScriptAuth } from "./AppsScriptAuth";

export type { AppsScriptAuthRepository } from "./storage/AppsScriptAuthRepository";

export type { AuthSchema, AuthSchemaOptions } from "./schema/AuthSchema";
export { createAuthTables } from "./schema/createAuthTables";

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

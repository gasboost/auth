/** Shared auth namespace for frontend providers and backend middleware. */
export const AUTH_METADATA_KEY = "@gasboost/auth";

export type AuthMetadata = {
  token: string;
};

export function isAuthMetadata(value: unknown): value is AuthMetadata {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, "token") &&
    "token" in value &&
    typeof value.token === "string" &&
    value.token.trim().length > 0
  );
}

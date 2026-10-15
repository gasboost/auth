import type { MetadataProvider } from "@gasboost/client";

import type { AuthStorage } from "../core/AuthStorage";
import { AUTH_METADATA_KEY, type AuthMetadata } from "../metadata";

export function authMetadataProvider(storage: AuthStorage): MetadataProvider {
  return () => {
    const token = storage.get();
    if (token === null || token.trim().length === 0) return undefined;
    return { [AUTH_METADATA_KEY]: { token } satisfies AuthMetadata };
  };
}

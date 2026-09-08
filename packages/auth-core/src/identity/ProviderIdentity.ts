import type { AuthPattern } from "../AuthPattern";

export interface ProviderIdentity {
  readonly providerName: AuthPattern;
  readonly accountId: string;
}

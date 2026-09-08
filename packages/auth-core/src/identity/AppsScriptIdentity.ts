import { authPattern } from "../AuthPattern";
import type { ProviderIdentity } from "./ProviderIdentity";

export class AppsScriptIdentity implements ProviderIdentity {
  public readonly providerName = authPattern.appsScript;
  public readonly accountId: string;

  constructor({ googleAccountAddress }: { googleAccountAddress: string }) {
    this.accountId = googleAccountAddress;
  }
}

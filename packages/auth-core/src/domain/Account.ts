import type { ProviderIdentity } from "../identity/ProviderIdentity";

export class Account {
  public readonly id: string;
  public readonly userId: string;
  public readonly identity: ProviderIdentity;

  constructor({
    id,
    userId,
    identity,
  }: {
    id: string;
    userId: string;
    identity: ProviderIdentity;
  }) {
    this.id = id;
    this.userId = userId;
    this.identity = identity;
  }
}

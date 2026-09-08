import { AuthPattern } from "../AuthPattern";
import type { Account } from "./Account";

export class User {
  public readonly id: string;
  public readonly name: string;
  public readonly accounts: Account[];

  constructor({
    id,
    name,
    accounts,
  }: {
    id: string;
    name: string;
    accounts: Account[];
  }) {
    this.id = id;
    this.name = name;
    this.accounts = accounts;
  }

  account(provider: AuthPattern): Account | null {
    return (
      this.accounts.find(
        (account) => account.identity.providerName === provider,
      ) || null
    );
  }
}

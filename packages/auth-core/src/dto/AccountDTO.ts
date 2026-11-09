import type { AuthPattern } from "../AuthPattern";
import type { Account } from "../domain/Account";

export class AccountDTO {
  readonly id: string;
  readonly userId: string;
  readonly providerName: AuthPattern;
  readonly accountId: string;

  constructor(account: Account) {
    this.id = account.id;
    this.userId = account.userId;
    this.providerName = account.identity.providerName;
    this.accountId = account.identity.accountId;
  }
}

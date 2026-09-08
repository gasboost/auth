import { authPattern } from "../AuthPattern";
import type { HashedPassword, Password } from "../domain/Password";
import type { ProviderIdentity } from "./ProviderIdentity";

export class EmailPasswordIdentity implements ProviderIdentity {
  public readonly providerName = authPattern.emailPassword;
  public readonly accountId: string;
  public readonly password: HashedPassword;

  constructor({
    accountId,
    password,
  }: {
    accountId: string;
    password: HashedPassword;
  }) {
    this.accountId = accountId;
    this.password = password;
  }

  async verify(password: Password): Promise<boolean> {
    return this.password.verify(password);
  }
}

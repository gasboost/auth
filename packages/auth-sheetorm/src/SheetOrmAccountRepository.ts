import {
  Account,
  AppsScriptIdentity,
  EmailPasswordIdentity,
  HashedPassword,
  authPattern,
  type AuthPattern,
} from "@gasboost/auth";
import type { SheetDB } from "@gasboost/sheetorm";

import type {
  SheetOrmAuthSchema,
  SheetOrmSchema,
  SheetOrmTableName,
} from "./SheetOrmAuthSchema";

export class SheetOrmAccountRepository<
  T extends SheetOrmSchema,
  U extends SheetOrmTableName<T>,
  A extends SheetOrmTableName<T>,
  R extends SheetOrmTableName<T>,
> {
  constructor(
    public readonly db: SheetDB<T>,
    public readonly schema: SheetOrmAuthSchema<T, U, A, R>,
  ) {}

  public async findByIdentity(
    provider: AuthPattern,
    identifier: string,
  ): Promise<Account | null> {
    const fields = this.schema.account.fields;

    const query = this.db
      .query(this.schema.account.modelName)
      .and(fields.provider, "=", [provider])
      .and(fields.providerAccountId, "=", [identifier])
      .limit(1);

    const [record] = this.db.find(query);

    if (!record) {
      return null;
    }

    const id = record[fields.id];
    const userId = record[fields.userId];
    const providerAccountId = record[fields.providerAccountId];

    if (provider === authPattern.appsScript) {
      return new Account({
        id,
        userId,
        identity: new AppsScriptIdentity({
          googleAccountAddress: providerAccountId,
        }),
      });
    }

    const passwordHash = record[fields.passwordHash];

    if (typeof passwordHash !== "string") {
      throw new Error("Password hash is required for email password account");
    }

    return new Account({
      id,
      userId,
      identity: new EmailPasswordIdentity({
        accountId: providerAccountId,
        password: new HashedPassword({
          value: passwordHash,
        }),
      }),
    });
  }
}

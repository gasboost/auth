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

  public async create(account: Account): Promise<Account> {
    const fields = this.schema.account.fields;
    const userFields = this.schema.user.fields;
    const record = this.db
      .definition(this.schema.account.modelName)
      .schema.parse({
        [fields.id]: account.id,
        [fields.userId]: account.userId,
        [fields.provider]: account.identity.providerName,
        [fields.providerAccountId]: account.identity.accountId,
        [fields.passwordHash]:
          account.identity instanceof EmailPasswordIdentity
            ? account.identity.password.value
            : null,
      });
    this.db.transaction(() => {
      const users = this.db.find(
        this.db
          .query(this.schema.user.modelName)
          .and(userFields.id, "=", [account.userId])
          .limit(1),
      );
      if (!users.length) throw new Error("User not found");
      const accounts = this.db.table(this.schema.account.modelName);
      const existing = accounts.find();
      for (const current of existing) {
        if (current[fields.id] === account.id)
          throw new Error("Account ID already registered");
        if (current[fields.provider] !== account.identity.providerName)
          continue;
        if (current[fields.providerAccountId] === account.identity.accountId)
          throw new Error("Account already registered");
        if (current[fields.userId] === account.userId)
          throw new Error("User already has an account for this provider");
      }
      accounts.create([record]);
    });
    return account;
  }

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

import {
  Account,
  AppsScriptIdentity,
  EmailPasswordIdentity,
  HashedPassword,
  User,
  authPattern,
} from "@gasboost/auth";
import type { SheetDB } from "@gasboost/sheetorm";

import type {
  SheetOrmAuthSchema,
  SheetOrmSchema,
  SheetOrmTableByName,
  SheetOrmTableName,
} from "./SheetOrmAuthSchema";

export class SheetOrmUserRepository<
  T extends SheetOrmSchema,
  U extends SheetOrmTableName<T>,
  A extends SheetOrmTableName<T>,
  R extends SheetOrmTableName<T>,
> {
  public readonly db: SheetDB<T>;
  public readonly schema: SheetOrmAuthSchema<T, U, A, R>;
  public readonly userTable: SheetOrmTableByName<T, U>;
  public readonly accountTable: SheetOrmTableByName<T, A>;

  constructor({
    db,
    schema,
  }: {
    db: SheetDB<T>;
    schema: SheetOrmAuthSchema<T, U, A, R>;
  }) {
    this.db = db;
    this.schema = schema;

    this.userTable = db.definition(schema.user.modelName);
    this.accountTable = db.definition(schema.account.modelName);
  }

  public async find(id: string): Promise<User | null> {
    const userFields = this.schema.user.fields;
    const accountFields = this.schema.account.fields;

    const userQuery = this.db
      .query<U>(this.schema.user.modelName)
      .and(userFields.id, "=", [id])
      .limit(1);

    const [userRecord] = this.db.find(userQuery);

    if (!userRecord) {
      return null;
    }

    const userId = userRecord[userFields.id];
    const name = userRecord[userFields.name];

    if (typeof userId !== "string" || typeof name !== "string") {
      throw new Error("Invalid user record");
    }

    const accountQuery = this.db
      .query<A>(this.schema.account.modelName)
      .and(accountFields.userId, "=", [userId]);

    const accountRecords = this.db.find(accountQuery);

    const accounts = accountRecords.map((record): Account => {
      const accountId = record[accountFields.id];

      const accountUserId = record[accountFields.userId];

      const provider = record[accountFields.provider];

      const providerAccountId = record[accountFields.providerAccountId];

      if (provider === authPattern.appsScript) {
        return new Account({
          id: accountId,
          userId: accountUserId,
          identity: new AppsScriptIdentity({
            googleAccountAddress: providerAccountId,
          }),
        });
      }

      if (provider === authPattern.emailPassword) {
        const passwordHash = record[accountFields.passwordHash];

        if (typeof passwordHash !== "string") {
          throw new Error(
            "Password hash is required for email password account",
          );
        }

        return new Account({
          id: accountId,
          userId: accountUserId,
          identity: new EmailPasswordIdentity({
            accountId: providerAccountId,
            password: new HashedPassword({
              value: passwordHash,
            }),
          }),
        });
      }

      throw new Error(`Unsupported auth provider '${String(provider)}'`);
    });

    return new User({
      id: userId,
      name,
      accounts,
    });
  }

  public async create(user: User): Promise<User> {
    const userFields = this.schema.user.fields;
    const accountFields = this.schema.account.fields;

    const userRecord = this.userTable.schema.parse({
      [userFields.id]: user.id,
      [userFields.name]: user.name,
    });

    const accountRecords = user.accounts.map((account) =>
      this.accountTable.schema.parse({
        [accountFields.id]: account.id,

        [accountFields.userId]: account.userId,

        [accountFields.provider]: account.identity.providerName,

        [accountFields.providerAccountId]: account.identity.accountId,

        [accountFields.passwordHash]:
          account.identity instanceof EmailPasswordIdentity
            ? account.identity.password.value
            : null,
      }),
    );

    this.db.transaction(() => {
      this.db.table(this.schema.user.modelName).create([userRecord]);

      if (accountRecords.length > 0) {
        this.db.table(this.schema.account.modelName).create(accountRecords);
      }
    });

    return user;
  }
}

import {
  Account,
  EmailPasswordIdentity,
  HashedPassword,
  PasswordCredential,
  PasswordReset,
  authPattern,
} from "@gasboost/auth";
import type { SheetDB } from "@gasboost/sheetorm";

import type {
  SheetOrmAuthSchema,
  SheetOrmSchema,
  SheetOrmTableByName,
  SheetOrmTableName,
} from "./SheetOrmAuthSchema";

export class SheetOrmPasswordCredentialRepository<
  T extends SheetOrmSchema,
  U extends SheetOrmTableName<T>,
  A extends SheetOrmTableName<T>,
  R extends SheetOrmTableName<T>,
> {
  public readonly db: SheetDB<T>;
  public readonly schema: SheetOrmAuthSchema<T, U, A, R>;
  public readonly accountTable: SheetOrmTableByName<T, A>;
  public readonly passwordResetTable: SheetOrmTableByName<T, R>;

  constructor({
    db,
    schema,
  }: {
    db: SheetDB<T>;
    schema: SheetOrmAuthSchema<T, U, A, R>;
  }) {
    this.db = db;
    this.schema = schema;

    this.accountTable = db.definition(schema.account.modelName);
    this.passwordResetTable = db.definition(schema.passwordReset.modelName);
  }

  public async findByResetTokenHash(
    tokenHash: string,
  ): Promise<PasswordCredential | null> {
    const resetFields = this.schema.passwordReset.fields;
    const accountFields = this.schema.account.fields;

    const resetQuery = this.db
      .query<R>(this.schema.passwordReset.modelName)
      .and(resetFields.tokenHash, "=", [tokenHash])
      .limit(1);

    const [resetRecord] = this.db.find(resetQuery);

    if (!resetRecord) {
      return null;
    }

    const reset = new PasswordReset({
      id: resetRecord[resetFields.id],
      accountId: resetRecord[resetFields.accountId],
      tokenHash: resetRecord[resetFields.tokenHash],
      expiresAt: resetRecord[resetFields.expiresAt],
      enabled: resetRecord[resetFields.enabled],
    });

    const accountQuery = this.db
      .query<A>(this.schema.account.modelName)
      .and(accountFields.id, "=", [reset.accountId])
      .and(accountFields.provider, "=", [authPattern.emailPassword])
      .limit(1);

    const [accountRecord] = this.db.find(accountQuery);

    if (!accountRecord) {
      throw new Error("Password credential account not found");
    }

    const passwordHash = accountRecord[accountFields.passwordHash];

    if (typeof passwordHash !== "string") {
      throw new Error("Password hash is required for email password account");
    }

    const account = new Account({
      id: accountRecord[accountFields.id],
      userId: accountRecord[accountFields.userId],
      identity: new EmailPasswordIdentity({
        accountId: accountRecord[accountFields.providerAccountId],
        password: new HashedPassword({
          value: passwordHash,
        }),
      }),
    });

    return new PasswordCredential({
      account,
      reset,
    });
  }

  public async save(credential: PasswordCredential): Promise<void> {
    if (!(credential.account.identity instanceof EmailPasswordIdentity)) {
      throw new Error("Invalid account identity");
    }

    const accountFields = this.schema.account.fields;
    const resetFields = this.schema.passwordReset.fields;

    const accountRecord = this.accountTable.schema.parse({
      [accountFields.id]: credential.account.id,
      [accountFields.userId]: credential.account.userId,
      [accountFields.provider]: credential.account.identity.providerName,
      [accountFields.providerAccountId]: credential.account.identity.accountId,
      [accountFields.passwordHash]: credential.account.identity.password.value,
    });

    const resetRecord =
      credential.reset === null
        ? null
        : this.passwordResetTable.schema.parse({
            [resetFields.id]: credential.reset.id,
            [resetFields.accountId]: credential.reset.accountId,
            [resetFields.tokenHash]: credential.reset.tokenHash,
            [resetFields.expiresAt]: credential.reset.expiresAt,
            [resetFields.enabled]: credential.reset.enabled,
          });

    this.db.transaction(() => {
      this.db.table(this.schema.account.modelName).update([accountRecord]);

      if (resetRecord) {
        this.db
          .table(this.schema.passwordReset.modelName)
          .upsert([resetRecord]);
      }
    });
  }
}

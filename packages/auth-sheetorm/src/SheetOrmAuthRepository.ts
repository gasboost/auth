import type { AppsScriptAuthRepository } from "@gasboost/auth";
import type { SheetDB } from "@gasboost/sheetorm";

import { SheetOrmAccountRepository } from "./SheetOrmAccountRepository";
import type {
  SheetOrmAuthSchema,
  SheetOrmSchema,
  SheetOrmTableName,
} from "./SheetOrmAuthSchema";
import { SheetOrmPasswordCredentialRepository } from "./SheetOrmPasswordCredentialRepository";
import { SheetOrmUserRepository } from "./SheetOrmUserRepository";

export class SheetOrmAuthRepository<
  T extends SheetOrmSchema,
  U extends SheetOrmTableName<T>,
  A extends SheetOrmTableName<T>,
  R extends SheetOrmTableName<T>,
> implements AppsScriptAuthRepository {
  public readonly account: SheetOrmAccountRepository<T, U, A, R>;
  public readonly user: SheetOrmUserRepository<T, U, A, R>;
  public readonly passwordCredential: SheetOrmPasswordCredentialRepository<
    T,
    U,
    A,
    R
  >;

  constructor({
    db,
    schema,
  }: {
    db: SheetDB<T>;
    schema: SheetOrmAuthSchema<T, U, A, R>;
  }) {
    this.account = new SheetOrmAccountRepository(db, schema);

    this.user = new SheetOrmUserRepository({
      db,
      schema,
    });

    this.passwordCredential = new SheetOrmPasswordCredentialRepository({
      db,
      schema,
    });
  }
}

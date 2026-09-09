import type { AppsScriptAuthRepository } from "@gasboost/auth";
import type { SheetDB } from "@gasboost/sheetorm";

import { SheetOrmAccountRepository } from "./SheetOrmAccountRepository";
import type {
  SheetOrmAuthSchema,
  SheetOrmSchema,
  SheetOrmTableName,
} from "./SheetOrmAuthSchema";
import { SheetOrmUserRepository } from "./SheetOrmUserRepository";

export class SheetOrmAuthRepository<
  T extends SheetOrmSchema,
  U extends SheetOrmTableName<T>,
  A extends SheetOrmTableName<T>,
> implements AppsScriptAuthRepository {
  public readonly account: SheetOrmAccountRepository<T, U, A>;
  public readonly user: SheetOrmUserRepository<T, U, A>;

  constructor({
    db,
    schema,
    tables,
  }: {
    db: SheetDB<T>;
    schema: SheetOrmAuthSchema<T, U, A>;
    tables: T;
  }) {
    this.account = new SheetOrmAccountRepository(db, schema);

    this.user = new SheetOrmUserRepository({
      db,
      schema,
      tables,
    });
  }
}

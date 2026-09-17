import type { AuthPattern, AuthSchema } from "@gasboost/auth";
import type { SheetTable } from "@gasboost/sheetorm";
import type { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SheetOrmSchema = readonly SheetTable<string, any>[];

export type SheetOrmTableName<T extends SheetOrmSchema> = T[number]["name"];

export type SheetOrmTableByName<
  T extends SheetOrmSchema,
  N extends SheetOrmTableName<T>,
> = Extract<T[number], { name: N }>;

export type SheetOrmRecord<
  T extends SheetOrmSchema,
  N extends SheetOrmTableName<T>,
> = z.infer<SheetOrmTableByName<T, N>["schema"]>;

export type SheetOrmFieldAccepting<
  T extends SheetOrmSchema,
  N extends SheetOrmTableName<T>,
  V,
> = Extract<keyof SheetOrmRecord<T, N>, string> &
  {
    [K in keyof SheetOrmRecord<T, N>]: V extends SheetOrmRecord<T, N>[K]
      ? K
      : never;
  }[keyof SheetOrmRecord<T, N>] &
  string;

export type SheetOrmUserSchema<
  T extends SheetOrmSchema,
  N extends SheetOrmTableName<T>,
> = AuthSchema["user"] & {
  modelName: N;

  fields: {
    id: SheetOrmFieldAccepting<T, N, string>;
    name: SheetOrmFieldAccepting<T, N, string>;
  };
};

export type SheetOrmAccountSchema<
  T extends SheetOrmSchema,
  N extends SheetOrmTableName<T>,
> = AuthSchema["account"] & {
  modelName: N;

  fields: {
    id: SheetOrmFieldAccepting<T, N, string>;
    userId: SheetOrmFieldAccepting<T, N, string>;
    provider: SheetOrmFieldAccepting<T, N, AuthPattern>;
    providerAccountId: SheetOrmFieldAccepting<T, N, string>;
    passwordHash: SheetOrmFieldAccepting<T, N, string>;
  };
};

export type SheetOrmPasswordResetSchema<
  T extends SheetOrmSchema,
  N extends SheetOrmTableName<T>,
> = AuthSchema["passwordReset"] & {
  modelName: N;

  fields: {
    id: SheetOrmFieldAccepting<T, N, string>;
    accountId: SheetOrmFieldAccepting<T, N, string>;
    tokenHash: SheetOrmFieldAccepting<T, N, string>;
    expiresAt: SheetOrmFieldAccepting<T, N, Date>;
    enabled: SheetOrmFieldAccepting<T, N, boolean>;
  };
};

export type SheetOrmAuthSchema<
  T extends SheetOrmSchema,
  U extends SheetOrmTableName<T>,
  A extends SheetOrmTableName<T>,
  R extends SheetOrmTableName<T>,
> = {
  user: SheetOrmUserSchema<T, U>;
  account: SheetOrmAccountSchema<T, A>;
  passwordReset: SheetOrmPasswordResetSchema<T, R>;
};

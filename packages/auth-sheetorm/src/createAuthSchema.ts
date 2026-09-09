import type { AuthSchema } from "@gasboost/auth";
import { SheetTable } from "@gasboost/sheetorm";
import { z } from "zod";

export function createAuthSchema<const S extends AuthSchema>(schema: S) {
  const userSchema = z.object({
    [schema.user.fields.id]: z.string(),
    [schema.user.fields.name]: z.string(),
  });

  const accountSchema = z.object({
    [schema.account.fields.id]: z.string(),
    [schema.account.fields.userId]: z.string(),
    [schema.account.fields.provider]: z.enum(["emailPassword", "appsScript"]),
    [schema.account.fields.providerAccountId]: z.string(),
    [schema.account.fields.passwordHash]: z.string().nullable(),
  });

  const userTable = new SheetTable<S["user"]["modelName"], typeof userSchema>({
    dbId: schema.dbId,
    name: schema.user.modelName,
    schema: userSchema,
    primaryKey: schema.user.fields.id,
  });

  const accountTable = new SheetTable<
    S["account"]["modelName"],
    typeof accountSchema
  >({
    dbId: schema.dbId,
    name: schema.account.modelName,
    schema: accountSchema,
    primaryKey: schema.account.fields.id,
  });

  return [userTable, accountTable] as const;
}

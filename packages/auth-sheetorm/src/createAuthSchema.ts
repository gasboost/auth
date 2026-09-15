import type { AuthSchema } from "@gasboost/auth";
import { SheetTable } from "@gasboost/sheetorm";
import { z } from "zod";

type UserShape<S extends AuthSchema> = {
  [K in S["user"]["fields"]["id"] | S["user"]["fields"]["name"]]: z.ZodString;
};

type AccountShape<
  S extends AuthSchema,
  P extends z.ZodType,
  H extends z.ZodType,
> = {
  [
    K in
      | S["account"]["fields"]["id"]
      | S["account"]["fields"]["userId"]
      | S["account"]["fields"]["provider"]
      | S["account"]["fields"]["providerAccountId"]
      | S["account"]["fields"]["passwordHash"]
  ]: K extends S["account"]["fields"]["provider"]
    ? P
    : K extends S["account"]["fields"]["passwordHash"]
      ? H
      : z.ZodString;
};

type PasswordResetShape<
  S extends AuthSchema,
  D extends z.ZodType,
  B extends z.ZodType,
> = {
  [
    K in
      | S["passwordReset"]["fields"]["id"]
      | S["passwordReset"]["fields"]["accountId"]
      | S["passwordReset"]["fields"]["tokenHash"]
      | S["passwordReset"]["fields"]["expiresAt"]
      | S["passwordReset"]["fields"]["enabled"]
  ]: K extends S["passwordReset"]["fields"]["expiresAt"]
    ? D
    : K extends S["passwordReset"]["fields"]["enabled"]
      ? B
      : z.ZodString;
};

export function createAuthSchema<const S extends AuthSchema>(schema: S) {
  const userShape = {
    [schema.user.fields.id]: z.string(),
    [schema.user.fields.name]: z.string(),
  } as UserShape<S>;

  const userSchema = z.object(userShape);

  const providerSchema = z.enum(["emailPassword", "appsScript"]);
  const passwordHashSchema = z.string().nullable();

  const accountShape = {
    [schema.account.fields.id]: z.string(),
    [schema.account.fields.userId]: z.string(),
    [schema.account.fields.provider]: providerSchema,
    [schema.account.fields.providerAccountId]: z.string(),
    [schema.account.fields.passwordHash]: passwordHashSchema,
  } as AccountShape<S, typeof providerSchema, typeof passwordHashSchema>;

  const accountSchema = z.object(accountShape);

  const expiresAtSchema = z.date();
  const enabledSchema = z.boolean();

  const passwordResetShape = {
    [schema.passwordReset.fields.id]: z.string(),
    [schema.passwordReset.fields.accountId]: z.string(),
    [schema.passwordReset.fields.tokenHash]: z.string(),
    [schema.passwordReset.fields.expiresAt]: expiresAtSchema,
    [schema.passwordReset.fields.enabled]: enabledSchema,
  } as PasswordResetShape<S, typeof expiresAtSchema, typeof enabledSchema>;

  const passwordResetSchema = z.object(passwordResetShape);

  const userTable = new SheetTable<S["user"]["modelName"], typeof userSchema>({
    dbId: schema.dbId,
    name: schema.user.modelName,
    schema: userSchema,
    primaryKey: schema.user.fields.id as keyof z.infer<typeof userSchema>,
  });

  const accountTable = new SheetTable<
    S["account"]["modelName"],
    typeof accountSchema
  >({
    dbId: schema.dbId,
    name: schema.account.modelName,
    schema: accountSchema,
    primaryKey: schema.account.fields.id as keyof z.infer<typeof accountSchema>,
  });

  const passwordResetTable = new SheetTable<
    S["passwordReset"]["modelName"],
    typeof passwordResetSchema
  >({
    dbId: schema.dbId,
    name: schema.passwordReset.modelName,
    schema: passwordResetSchema,
    primaryKey: schema.passwordReset.fields.id as keyof z.infer<
      typeof passwordResetSchema
    >,
  });

  return [userTable, accountTable, passwordResetTable] as const;
}

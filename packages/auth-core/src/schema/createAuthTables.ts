import type { KeyedTableDefinition } from "@gasboost/table";
import { z } from "zod";

import {
  resolveAuthSchema,
  type AuthSchema,
  type AuthSchemaOptions,
} from "./AuthSchema";

type UserShape<S extends AuthSchema> = {
  [K in S["user"]["fields"]["id"] | S["user"]["fields"]["name"]]: z.ZodString;
};

type AccountShape<S extends AuthSchema> = {
  [
    K in
      | S["account"]["fields"]["id"]
      | S["account"]["fields"]["userId"]
      | S["account"]["fields"]["provider"]
      | S["account"]["fields"]["providerAccountId"]
      | S["account"]["fields"]["passwordHash"]
  ]: K extends S["account"]["fields"]["provider"]
    ? z.ZodEnum<{ emailPassword: "emailPassword"; appsScript: "appsScript" }>
    : K extends S["account"]["fields"]["passwordHash"]
      ? z.ZodNullable<z.ZodString>
      : z.ZodString;
};

type PasswordResetShape<S extends AuthSchema> = {
  [
    K in
      | S["passwordReset"]["fields"]["id"]
      | S["passwordReset"]["fields"]["accountId"]
      | S["passwordReset"]["fields"]["tokenHash"]
      | S["passwordReset"]["fields"]["expiresAt"]
      | S["passwordReset"]["fields"]["enabled"]
  ]: K extends S["passwordReset"]["fields"]["expiresAt"]
    ? z.ZodDate
    : K extends S["passwordReset"]["fields"]["enabled"]
      ? z.ZodBoolean
      : z.ZodString;
};

function ensureUniqueFieldNames(
  modelName: string,
  fields: Record<string, string>,
) {
  const fieldNames = Object.values(fields);
  if (new Set(fieldNames).size !== fieldNames.length) {
    throw new Error(`Field names for '${modelName}' must be unique.`);
  }
}

function keyedTable<
  const N extends string,
  const S extends z.ZodObject,
  const PK extends string,
>(definition: { name: N; schema: S; primaryKey: PK }) {
  return definition as KeyedTableDefinition<N, S> & { readonly primaryKey: PK };
}

export function createAuthTables<
  const O extends AuthSchemaOptions = Record<never, never>,
>(options: O = {} as O) {
  const schema = resolveAuthSchema(options);

  ensureUniqueFieldNames(schema.user.modelName, schema.user.fields);
  ensureUniqueFieldNames(schema.account.modelName, schema.account.fields);
  ensureUniqueFieldNames(
    schema.passwordReset.modelName,
    schema.passwordReset.fields,
  );

  const userSchema = z.object({
    [schema.user.fields.id]: z.string(),
    [schema.user.fields.name]: z.string(),
  } as UserShape<typeof schema>);

  const accountSchema = z.object({
    [schema.account.fields.id]: z.string(),
    [schema.account.fields.userId]: z.string(),
    [schema.account.fields.provider]: z.enum(["emailPassword", "appsScript"]),
    [schema.account.fields.providerAccountId]: z.string(),
    [schema.account.fields.passwordHash]: z.string().nullable(),
  } as AccountShape<typeof schema>);

  const passwordResetSchema = z.object({
    [schema.passwordReset.fields.id]: z.string(),
    [schema.passwordReset.fields.accountId]: z.string(),
    [schema.passwordReset.fields.tokenHash]: z.string(),
    [schema.passwordReset.fields.expiresAt]: z.date(),
    [schema.passwordReset.fields.enabled]: z.boolean(),
  } as PasswordResetShape<typeof schema>);

  return {
    schema,
    user: keyedTable({
      name: schema.user.modelName,
      schema: userSchema,
      primaryKey: schema.user.fields.id,
    }),
    account: keyedTable({
      name: schema.account.modelName,
      schema: accountSchema,
      primaryKey: schema.account.fields.id,
    }),
    passwordReset: keyedTable({
      name: schema.passwordReset.modelName,
      schema: passwordResetSchema,
      primaryKey: schema.passwordReset.fields.id,
    }),
  } as const;
}

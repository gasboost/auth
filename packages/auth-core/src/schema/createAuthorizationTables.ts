import type { KeyedTableDefinition } from "@gasboost/table";
import { z } from "zod";

import {
  resolveAuthorizationSchema,
  type AuthorizationSchema,
  type AuthorizationSchemaOptions,
} from "./AuthorizationSchema";

type RoleShape<S extends AuthorizationSchema> = {
  [
    K in
      | S["role"]["fields"]["id"]
      | S["role"]["fields"]["userId"]
      | S["role"]["fields"]["role"]
  ]: z.ZodString;
};

type PermissionShape<S extends AuthorizationSchema> = {
  [
    K in
      | S["permission"]["fields"]["id"]
      | S["permission"]["fields"]["userId"]
      | S["permission"]["fields"]["permission"]
      | S["permission"]["fields"]["effect"]
  ]: K extends S["permission"]["fields"]["effect"]
    ? z.ZodEnum<{ allow: "allow"; deny: "deny" }>
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

export function createAuthorizationTables<
  const O extends AuthorizationSchemaOptions = Record<never, never>,
>(options: O = {} as O) {
  const schema = resolveAuthorizationSchema(options);

  ensureUniqueFieldNames(schema.role.modelName, schema.role.fields);
  ensureUniqueFieldNames(schema.permission.modelName, schema.permission.fields);

  const roleSchema = z.object({
    [schema.role.fields.id]: z.string(),
    [schema.role.fields.userId]: z.string(),
    [schema.role.fields.role]: z.string(),
  } as RoleShape<typeof schema>);

  const permissionSchema = z.object({
    [schema.permission.fields.id]: z.string(),
    [schema.permission.fields.userId]: z.string(),
    [schema.permission.fields.permission]: z.string(),
    [schema.permission.fields.effect]: z.enum(["allow", "deny"]),
  } as PermissionShape<typeof schema>);

  return {
    schema,
    role: keyedTable({
      name: schema.role.modelName,
      schema: roleSchema,
      primaryKey: schema.role.fields.id,
    }),
    permission: keyedTable({
      name: schema.permission.modelName,
      schema: permissionSchema,
      primaryKey: schema.permission.fields.id,
    }),
  } as const;
}

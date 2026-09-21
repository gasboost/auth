import type {
  AuthorizationRepository,
  StoredPermissionOverride,
} from "@gasboost/auth";
import type { SheetDB } from "@gasboost/sheetorm";

import type {
  SheetOrmAuthorizationSchema,
  SheetOrmRecord,
  SheetOrmSchema,
  SheetOrmTableName,
} from "./SheetOrmAuthSchema";

type RoleRecord<
  T extends SheetOrmSchema,
  R extends SheetOrmTableName<T>,
> = SheetOrmRecord<T, R>;

type PermissionRecord<
  T extends SheetOrmSchema,
  P extends SheetOrmTableName<T>,
> = SheetOrmRecord<T, P>;

function assignmentKey(userId: string, value: string): string {
  return `${encodeURIComponent(userId)}:${encodeURIComponent(value)}`;
}

export class SheetOrmAuthorizationRepository<
  T extends SheetOrmSchema,
  R extends SheetOrmTableName<T>,
  P extends SheetOrmTableName<T>,
> implements AuthorizationRepository {
  public readonly role: AuthorizationRepository["role"];
  public readonly permission: AuthorizationRepository["permission"];

  constructor({
    db,
    schema,
  }: {
    db: SheetDB<T>;
    schema: SheetOrmAuthorizationSchema<T, R, P>;
  }) {
    this.role = {
      findByUserId: async (userId) =>
        db
          .table(schema.role.modelName)
          .find()
          .filter((record: RoleRecord<T, R>) => {
            return record[schema.role.fields.userId] === userId;
          })
          .map((record: RoleRecord<T, R>) => {
            return record[schema.role.fields.role] as string;
          }),

      assign: async (userId, role) => {
        db.table(schema.role.modelName).upsert([
          {
            [schema.role.fields.id]: assignmentKey(userId, role),
            [schema.role.fields.userId]: userId,
            [schema.role.fields.role]: role,
          } as RoleRecord<T, R>,
        ]);
      },

      revoke: async (userId, role) => {
        db.table(schema.role.modelName).delete([assignmentKey(userId, role)]);
      },
    };

    this.permission = {
      findByUserId: async (userId) =>
        db
          .table(schema.permission.modelName)
          .find()
          .filter((record: PermissionRecord<T, P>) => {
            return record[schema.permission.fields.userId] === userId;
          })
          .map((record: PermissionRecord<T, P>): StoredPermissionOverride => {
            return {
              permission: record[schema.permission.fields.permission] as string,
              effect: record[
                schema.permission.fields.effect
              ] as StoredPermissionOverride["effect"],
            };
          }),

      set: async (userId, permission, effect) => {
        db.table(schema.permission.modelName).upsert([
          {
            [schema.permission.fields.id]: assignmentKey(userId, permission),
            [schema.permission.fields.userId]: userId,
            [schema.permission.fields.permission]: permission,
            [schema.permission.fields.effect]: effect,
          } as PermissionRecord<T, P>,
        ]);
      },

      revoke: async (userId, permission) => {
        db.table(schema.permission.modelName).delete([
          assignmentKey(userId, permission),
        ]);
      },
    };
  }
}

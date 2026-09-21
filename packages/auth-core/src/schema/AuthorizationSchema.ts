export type AuthorizationSchemaOptions = {
  role?: {
    modelName?: string;
    fields?: {
      id?: string;
      userId?: string;
      role?: string;
    };
  };
  permission?: {
    modelName?: string;
    fields?: {
      id?: string;
      userId?: string;
      permission?: string;
      effect?: string;
    };
  };
};

export type AuthorizationSchema = {
  role: {
    modelName: string;
    fields: {
      id: string;
      userId: string;
      role: string;
    };
  };
  permission: {
    modelName: string;
    fields: {
      id: string;
      userId: string;
      permission: string;
      effect: string;
    };
  };
};

type Section<O, K extends PropertyKey> = K extends keyof O ? O[K] : undefined;

type Fields<T> = [T] extends [null | undefined]
  ? undefined
  : "fields" extends keyof NonNullable<T>
    ? NonNullable<T>["fields"]
    : undefined;

type PropertyOrDefault<T, K extends PropertyKey, Default extends string> = [
  T,
] extends [null | undefined]
  ? Default
  : K extends keyof NonNullable<T>
    ? Exclude<NonNullable<T>[K], undefined> extends infer Value
      ? [Value] extends [never]
        ? Default
        : Value extends string
          ? Value
          : Default
      : Default
    : Default;

export type ResolveAuthorizationSchema<O extends AuthorizationSchemaOptions> = {
  role: {
    modelName: PropertyOrDefault<
      Section<O, "role">,
      "modelName",
      "authorizationRole"
    >;
    fields: {
      id: PropertyOrDefault<Fields<Section<O, "role">>, "id", "id">;
      userId: PropertyOrDefault<Fields<Section<O, "role">>, "userId", "userId">;
      role: PropertyOrDefault<Fields<Section<O, "role">>, "role", "role">;
    };
  };

  permission: {
    modelName: PropertyOrDefault<
      Section<O, "permission">,
      "modelName",
      "authorizationPermission"
    >;
    fields: {
      id: PropertyOrDefault<Fields<Section<O, "permission">>, "id", "id">;
      userId: PropertyOrDefault<
        Fields<Section<O, "permission">>,
        "userId",
        "userId"
      >;
      permission: PropertyOrDefault<
        Fields<Section<O, "permission">>,
        "permission",
        "permission"
      >;
      effect: PropertyOrDefault<
        Fields<Section<O, "permission">>,
        "effect",
        "effect"
      >;
    };
  };
};

export function resolveAuthorizationSchema<
  const O extends AuthorizationSchemaOptions,
>(options: O): ResolveAuthorizationSchema<O> {
  return {
    role: {
      modelName: options.role?.modelName ?? "authorizationRole",
      fields: {
        id: options.role?.fields?.id ?? "id",
        userId: options.role?.fields?.userId ?? "userId",
        role: options.role?.fields?.role ?? "role",
      },
    },
    permission: {
      modelName: options.permission?.modelName ?? "authorizationPermission",
      fields: {
        id: options.permission?.fields?.id ?? "id",
        userId: options.permission?.fields?.userId ?? "userId",
        permission: options.permission?.fields?.permission ?? "permission",
        effect: options.permission?.fields?.effect ?? "effect",
      },
    },
  } as ResolveAuthorizationSchema<O>;
}

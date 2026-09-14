export type AuthSchemaOptions = {
  dbId: string;
  user?: {
    modelName?: string;
    fields?: {
      id?: string;
      name?: string;
    };
  };
  account?: {
    modelName?: string;
    fields?: {
      id?: string;
      userId?: string;
      provider?: string;
      providerAccountId?: string;
      passwordHash?: string;
    };
  };
  passwordReset?: {
    modelName?: string;
    fields?: {
      id?: string;
      accountId?: string;
      tokenHash?: string;
      expiresAt?: string;
      enabled?: string;
    };
  };
};

export type AuthSchema = {
  dbId: string;
  user: {
    modelName: string;
    fields: {
      id: string;
      name: string;
    };
  };
  account: {
    modelName: string;
    fields: {
      id: string;
      userId: string;
      provider: string;
      providerAccountId: string;
      passwordHash: string;
    };
  };
  passwordReset: {
    modelName: string;
    fields: {
      id: string;
      accountId: string;
      tokenHash: string;
      expiresAt: string;
      enabled: string;
    };
  };
};

type Section<O, K extends PropertyKey> = O extends { [P in K]: infer Value }
  ? Value
  : undefined;

type Fields<T> = T extends { fields: infer Value } ? Value : undefined;

type PropertyOrDefault<
  T,
  K extends PropertyKey,
  Default extends string,
> = T extends { [P in K]?: infer Value }
  ? Value extends string
    ? Value
    : Default
  : Default;

type ResolveAuthSchema<O extends AuthSchemaOptions> = {
  dbId: O["dbId"];

  user: {
    modelName: PropertyOrDefault<Section<O, "user">, "modelName", "user">;
    fields: {
      id: PropertyOrDefault<Fields<Section<O, "user">>, "id", "id">;
      name: PropertyOrDefault<Fields<Section<O, "user">>, "name", "name">;
    };
  };

  account: {
    modelName: PropertyOrDefault<Section<O, "account">, "modelName", "account">;
    fields: {
      id: PropertyOrDefault<Fields<Section<O, "account">>, "id", "id">;
      userId: PropertyOrDefault<
        Fields<Section<O, "account">>,
        "userId",
        "userId"
      >;
      provider: PropertyOrDefault<
        Fields<Section<O, "account">>,
        "provider",
        "provider"
      >;
      providerAccountId: PropertyOrDefault<
        Fields<Section<O, "account">>,
        "providerAccountId",
        "providerAccountId"
      >;
      passwordHash: PropertyOrDefault<
        Fields<Section<O, "account">>,
        "passwordHash",
        "passwordHash"
      >;
    };
  };

  passwordReset: {
    modelName: PropertyOrDefault<
      Section<O, "passwordReset">,
      "modelName",
      "passwordReset"
    >;
    fields: {
      id: PropertyOrDefault<Fields<Section<O, "passwordReset">>, "id", "id">;
      accountId: PropertyOrDefault<
        Fields<Section<O, "passwordReset">>,
        "accountId",
        "accountId"
      >;
      tokenHash: PropertyOrDefault<
        Fields<Section<O, "passwordReset">>,
        "tokenHash",
        "tokenHash"
      >;
      expiresAt: PropertyOrDefault<
        Fields<Section<O, "passwordReset">>,
        "expiresAt",
        "expiresAt"
      >;
      enabled: PropertyOrDefault<
        Fields<Section<O, "passwordReset">>,
        "enabled",
        "enabled"
      >;
    };
  };
};

export class AuthSchemaConfig<
  const O extends AuthSchemaOptions = { dbId: "" },
> {
  public readonly schema: ResolveAuthSchema<O>;

  constructor(options: O = { dbId: "" } as O) {
    this.schema = {
      dbId: options.dbId,

      user: {
        modelName: options.user?.modelName ?? "user",
        fields: {
          id: options.user?.fields?.id ?? "id",
          name: options.user?.fields?.name ?? "name",
        },
      },

      account: {
        modelName: options.account?.modelName ?? "account",
        fields: {
          id: options.account?.fields?.id ?? "id",
          userId: options.account?.fields?.userId ?? "userId",
          provider: options.account?.fields?.provider ?? "provider",
          providerAccountId:
            options.account?.fields?.providerAccountId ?? "providerAccountId",
          passwordHash: options.account?.fields?.passwordHash ?? "passwordHash",
        },
      },

      passwordReset: {
        modelName: options.passwordReset?.modelName ?? "passwordReset",
        fields: {
          id: options.passwordReset?.fields?.id ?? "id",
          accountId: options.passwordReset?.fields?.accountId ?? "accountId",
          tokenHash: options.passwordReset?.fields?.tokenHash ?? "tokenHash",
          expiresAt: options.passwordReset?.fields?.expiresAt ?? "expiresAt",
          enabled: options.passwordReset?.fields?.enabled ?? "enabled",
        },
      },
    } as ResolveAuthSchema<O>;
  }
}

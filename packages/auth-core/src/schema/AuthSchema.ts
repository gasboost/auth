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

export class AuthSchemaConfig {
  public readonly schema: AuthSchema;

  constructor(options: AuthSchemaOptions = { dbId: "" }) {
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
    };
  }
}

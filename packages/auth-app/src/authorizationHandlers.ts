type AuthorizationService = {
  readonly role: {
    assign(userId: string, role: string): Promise<void>;
    revoke(userId: string, role: string): Promise<void>;
  };
  readonly permission: {
    allow(userId: string, permission: string): Promise<void>;
    deny(userId: string, permission: string): Promise<void>;
    revoke(userId: string, permission: string): Promise<void>;
  };
};

type AuthorizationRole<TAuthorization> = TAuthorization extends {
  readonly role: {
    assign(userId: string, role: infer TRole): unknown;
  };
}
  ? TRole
  : never;

type AuthorizationPermission<TAuthorization> = TAuthorization extends {
  readonly permission: {
    allow(userId: string, permission: infer TPermission): unknown;
  };
}
  ? TPermission
  : never;

export type AuthorizationHandlers<TAuthorization extends AuthorizationService> =
  {
    readonly role: {
      assign(input: {
        readonly userId: string;
        readonly role: AuthorizationRole<TAuthorization>;
      }): Promise<void>;
      revoke(input: {
        readonly userId: string;
        readonly role: AuthorizationRole<TAuthorization>;
      }): Promise<void>;
    };
    readonly permission: {
      allow(input: {
        readonly userId: string;
        readonly permission: AuthorizationPermission<TAuthorization>;
      }): Promise<void>;
      deny(input: {
        readonly userId: string;
        readonly permission: AuthorizationPermission<TAuthorization>;
      }): Promise<void>;
      revoke(input: {
        readonly userId: string;
        readonly permission: AuthorizationPermission<TAuthorization>;
      }): Promise<void>;
    };
  };

export function authorizationHandlers<
  TAuthorization extends AuthorizationService,
>(authorization: TAuthorization): AuthorizationHandlers<TAuthorization> {
  return {
    role: {
      assign: ({ userId, role }) => authorization.role.assign(userId, role),
      revoke: ({ userId, role }) => authorization.role.revoke(userId, role),
    },
    permission: {
      allow: ({ userId, permission }) =>
        authorization.permission.allow(userId, permission),
      deny: ({ userId, permission }) =>
        authorization.permission.deny(userId, permission),
      revoke: ({ userId, permission }) =>
        authorization.permission.revoke(userId, permission),
    },
  };
}

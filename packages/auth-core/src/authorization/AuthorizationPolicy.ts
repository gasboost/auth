export type PermissionStatement = Record<string, readonly string[]>;

export type PermissionOf<TStatement extends PermissionStatement> = {
  [TResource in Extract<keyof TStatement, string>]: `${TResource}:${Extract<
    TStatement[TResource][number],
    string
  >}`;
}[Extract<keyof TStatement, string>];

export type PermissionRequirement<TStatement extends PermissionStatement> = {
  readonly [
    TResource in keyof TStatement
  ]?: readonly TStatement[TResource][number][];
};

export type EffectivePermissions<TPermission extends string> =
  readonly TPermission[];

export type PermissionEffect = "allow" | "deny";

export type StoredPermissionOverride = {
  readonly permission: string;
  readonly effect: PermissionEffect;
};

export type AuthorizationResolutionInput = {
  readonly roles: readonly string[];
  readonly permissions: readonly StoredPermissionOverride[];
};

type RoleGrantMap = ReadonlyMap<string, readonly string[]>;

function flattenRequirement<TStatement extends PermissionStatement>(
  requirement: PermissionRequirement<TStatement>,
): PermissionOf<TStatement>[] {
  const permissions: string[] = [];

  for (const [resource, actions] of Object.entries(requirement)) {
    for (const action of actions ?? []) {
      permissions.push(`${resource}:${action}`);
    }
  }

  return permissions as PermissionOf<TStatement>[];
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export class AuthorizationPolicy<
  const TStatement extends PermissionStatement,
  TRole extends string = never,
> {
  public readonly $types!: {
    readonly role: TRole;
    readonly permission: PermissionOf<TStatement>;
  };

  private readonly permissions: ReadonlySet<string>;
  private readonly roleGrants: RoleGrantMap;

  constructor(
    public readonly statement: TStatement,
    roleGrants: RoleGrantMap = new Map(),
  ) {
    this.permissions = new Set(flattenRequirement(statement));
    this.roleGrants = roleGrants;
  }

  public linkRole<
    const TName extends string,
    const TRequirement extends PermissionRequirement<TStatement>,
  >(
    name: TName,
    requirement: TRequirement,
  ): AuthorizationPolicy<TStatement, TRole | TName> {
    return new AuthorizationPolicy(
      this.statement,
      new Map([
        ...this.roleGrants,
        [name, unique(flattenRequirement(requirement))],
      ]),
    );
  }

  public resolve(
    input: AuthorizationResolutionInput,
  ): EffectivePermissions<PermissionOf<TStatement>> {
    const deniedPermissions = new Set(
      input.permissions
        .filter(({ effect }) => effect === "deny")
        .map(({ permission }) => permission)
        .filter((permission) => this.permissions.has(permission)),
    );

    const resolved = new Set<string>();

    for (const { effect, permission } of input.permissions) {
      if (
        effect === "allow" &&
        this.permissions.has(permission) &&
        !deniedPermissions.has(permission)
      ) {
        resolved.add(permission);
      }
    }

    for (const role of input.roles) {
      const permissions = this.roleGrants.get(role);

      if (permissions === undefined) {
        continue;
      }

      for (const permission of permissions) {
        if (!deniedPermissions.has(permission)) {
          resolved.add(permission);
        }
      }
    }

    return [...resolved] as PermissionOf<TStatement>[];
  }

  public can(
    permissions: EffectivePermissions<PermissionOf<TStatement>>,
    requirement: PermissionRequirement<TStatement>,
  ): boolean {
    const granted = new Set(permissions);

    return flattenRequirement(requirement).every((permission) =>
      granted.has(permission),
    );
  }
}

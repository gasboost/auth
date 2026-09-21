import type {
  AuthorizationPolicy,
  EffectivePermissions,
  PermissionOf,
  PermissionRequirement,
  PermissionStatement,
} from "./AuthorizationPolicy";
import type { AuthorizationRepository } from "./AuthorizationRepository";

type PolicyStatement<TPolicy> =
  TPolicy extends AuthorizationPolicy<infer TStatement, string>
    ? TStatement
    : never;

type PolicyRole<TPolicy> = TPolicy extends {
  readonly $types: { readonly role: infer TRole };
}
  ? Extract<TRole, string>
  : never;

type PolicyPermission<TPolicy> = TPolicy extends {
  readonly $types: { readonly permission: infer TPermission };
}
  ? Extract<TPermission, string>
  : never;

export class AppsScriptAuthorization<
  TPolicy extends AuthorizationPolicy<PermissionStatement, string>,
> {
  public readonly role: {
    assign(userId: string, role: PolicyRole<TPolicy>): Promise<void>;
    revoke(userId: string, role: PolicyRole<TPolicy>): Promise<void>;
  };

  public readonly permission: {
    allow(userId: string, permission: PolicyPermission<TPolicy>): Promise<void>;
    deny(userId: string, permission: PolicyPermission<TPolicy>): Promise<void>;
    revoke(
      userId: string,
      permission: PolicyPermission<TPolicy>,
    ): Promise<void>;
  };

  private readonly policy: TPolicy;
  private readonly repository: AuthorizationRepository;

  constructor({
    policy,
    repository,
  }: {
    policy: TPolicy;
    repository: AuthorizationRepository;
  }) {
    this.policy = policy;
    this.repository = repository;

    this.role = {
      assign: (userId, role) => this.repository.role.assign(userId, role),
      revoke: (userId, role) => this.repository.role.revoke(userId, role),
    };

    this.permission = {
      allow: (userId, permission) =>
        this.repository.permission.set(userId, permission, "allow"),
      deny: (userId, permission) =>
        this.repository.permission.set(userId, permission, "deny"),
      revoke: (userId, permission) =>
        this.repository.permission.revoke(userId, permission),
    };
  }

  public async resolve(
    userId: string,
  ): Promise<EffectivePermissions<PermissionOf<PolicyStatement<TPolicy>>>> {
    const [roles, permissions] = await Promise.all([
      this.repository.role.findByUserId(userId),
      this.repository.permission.findByUserId(userId),
    ]);

    return this.policy.resolve({
      roles,
      permissions,
    }) as EffectivePermissions<PermissionOf<PolicyStatement<TPolicy>>>;
  }

  public async can(
    userId: string,
    requirement: PermissionRequirement<PolicyStatement<TPolicy>>,
  ): Promise<boolean> {
    return this.policy.can(await this.resolve(userId), requirement);
  }
}

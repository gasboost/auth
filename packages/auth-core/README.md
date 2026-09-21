# @gasboost/auth

Google Apps Script 向けの認証ライブラリです。

`@gasboost/auth` は、GAS Web App の公開設定とは独立して、アプリケーション上の User / Account / Identity / Session を扱います。

初期実装では以下の認証方式を提供します。

- Email / Password
- Apps Script Active User

また、Session の保存先として以下を利用できます。

- `CacheService`
- `PropertiesService`

## Install

```bash
pnpm add @gasboost/auth
```

npm:

```bash
npm install @gasboost/auth
```

## Concepts

認証 Identity と Application User は直接同一視しません。

```text
ProviderIdentity
      ↓
Account
      ↓
User
      ↓
Session
```

1つの User に複数の Account を紐付けることができます。

```text
User
├─ Account(emailPassword)
└─ Account(appsScript)
```

Identity は `(provider, accountId)` の組み合わせで識別します。

そのため、同じメールアドレスでも認証方式が異なれば別の Identity として扱えます。

```text
(emailPassword, user@example.com)
(appsScript, user@example.com)
```

## Repository

`@gasboost/auth` は特定の Database / ORM に依存しません。

利用側で `AppsScriptAuthRepository` を実装して注入します。

```ts
import type { AppsScriptAuthRepository } from "@gasboost/auth";

const repository: AppsScriptAuthRepository = {
  account: {
    async findByIdentity(provider, identifier) {
      // Account を検索
      return null;
    },
  },

  user: {
    async find(id) {
      // User を検索
      return null;
    },

    async create(user) {
      // User + Account を保存
      return user;
    },
  },
};
```

将来的に SheetORM 向け adapter は auth-core とは別 package として提供する想定です。

## Authorization

アプリケーション内部の認可には、GAS runtime に依存しない `AuthorizationPolicy` と、Backend service の `AppsScriptAuthorization` を利用できます。

```ts
import {
  AppsScriptAuthorization,
  createAuthorizationTables,
} from "@gasboost/auth";
import { AuthorizationPolicy } from "@gasboost/auth/authorization";

export const authorizationPolicy = new AuthorizationPolicy({
  project: ["read", "create", "update", "delete"],
  authorization: ["manage"],
} as const)
  .linkRole("admin", {
    project: ["read", "create", "update", "delete"],
    authorization: ["manage"],
  })
  .linkRole("member", {
    project: ["read"],
  });

const authorizationTables = createAuthorizationTables();

const authorization = new AppsScriptAuthorization({
  policy: authorizationPolicy,
  repository: authorizationRepository,
});
```

`@gasboost/auth/authorization` は pure な subpath export です。Frontend / shared code では `AuthorizationPolicy` だけを import し、Backend で取得した effective permissions の表示制御に同じ `can()` を使えます。

```ts
const permissions = await authorization.resolve(session.userId);

authorizationPolicy.can(permissions, {
  project: ["update"],
});
```

Role definition と permission vocabulary は application code が source of truth です。Repository には assignment だけを保存し、未知の role / permission は grant せず fail closed になります。

## Initialize

`AppsScriptAuth` に Repository、GAS runtime、Session 設定、認証方式の設定を渡します。

```ts
import { AppsScriptAuth } from "@gasboost/auth";

const pepper =
  PropertiesService.getScriptProperties().getProperty("AUTH_PEPPER") ?? "";

const auth = new AppsScriptAuth({
  repository,

  runtime: {
    utilities: Utilities,
    session: Session,
    cacheService: CacheService,
    propertiesService: PropertiesService,
  },

  session: {
    storageType: "cache",
    expiresIn: 60 * 20,
  },

  emailPassword: {
    enabled: true,
    isSignupEnabled: true,
    pepper,
  },

  appsScript: {
    enabled: true,
    isSignupEnabled: true,
  },
});
```

`runtime` を constructor injection するため、auth-core 内部では GAS global を直接参照しません。

これにより、テスト環境では `@gasboost/fake-core` / `@gasboost/fake-node` などの fake implementation を注入できます。

## Session Storage

### CacheService

```ts
session: {
  storageType: "cache",
  expiresIn: 60 * 20,
}
```

CacheService の TTL を利用して Session を保持します。

低レイテンシな Session Storage として利用できます。

### PropertiesService

```ts
session: {
  storageType: "properties",
  expiresIn: 60 * 20,
}
```

PropertiesService では Session を以下の key 形式で保存します。

```text
session:<sessionId>
```

そのため、同じ Properties に保存された `API_KEY` などの別データとは分離されます。

期限切れ Session は `cleanup()` で削除できます。

## Email / Password Sign Up

```ts
const { user, session } = await auth.signUp.email({
  name: "Taro",
  email: "user@example.com",
  password: "password",
});
```

処理フロー:

```text
email identity の重複確認
        ↓
password hash
        ↓
EmailPasswordIdentity
        ↓
Account
        ↓
User
        ↓
Session 発行
```

## Email / Password Sign In

```ts
const { user, session } = await auth.signIn.email({
  email: "user@example.com",
  password: "password",
});
```

処理フロー:

```text
email
  ↓
Account 検索
  ↓
password verify
  ↓
User 検索
  ↓
Session 発行
```

## Apps Script Sign Up

Apps Script 認証では `Session.getActiveUser().getEmail()` を Identity として利用します。

```ts
const { user, session } = await auth.signUp.appsScript({
  name: "Taro",
});
```

Active User の email を取得できない場合は登録できません。

## Apps Script Sign In

```ts
const { user, session } = await auth.signIn.appsScript({});
```

処理フロー:

```text
Session.getActiveUser().getEmail()
        ↓
AppsScriptIdentity
        ↓
Account 検索
        ↓
User 検索
        ↓
Session 発行
```

## Authentication Hooks

`@gasboost/auth` は、認証成功後に外部処理を実行するための lifecycle hook を提供します。

現在は `afterSignIn` を利用できます。

```ts
import { AppsScriptAuth, type EmailPasswordAuthOptions } from "@gasboost/auth";

type HookResult = {
  readonly customToken: string;
};

const auth = new AppsScriptAuth<EmailPasswordAuthOptions, HookResult>({
  repository,
  runtime,

  session: {
    storageType: "cache",
  },

  emailPassword: {
    enabled: true,
    pepper,
  },

  hooks: {
    afterSignIn: ({ user, session }) => ({
      customToken: `${user.id}:${session.id}`,
    }),
  },
});
```

`afterSignIn` には、認証された `User` と発行済みの `Session` が渡されます。

```ts
hooks: {
  afterSignIn: ({ user, session }) => {
    user.id;
    session.id;

    return {
      customToken: "...",
    };
  },
},
```

hook の戻り値は Sign In result の `hooks` から取得できます。

```ts
const result = await auth.signIn.email({
  email: "user@example.com",
  password: "password",
});

result.user;
result.session;
result.hooks.customToken;
```

hook result の型は `AppsScriptAuth` の第2型引数として指定できます。

```ts
type HookResult = {
  readonly customToken: string;
};

const auth = new AppsScriptAuth<EmailPasswordAuthOptions, HookResult>({
  // ...
});
```

hook を設定しない場合、従来どおり Sign In result は `user` と `session` のみを返します。

```ts
const auth = new AppsScriptAuth({
  repository,
  runtime,

  session: {
    storageType: "cache",
  },
});

const result = await auth.signIn.appsScript({});

result.user;
result.session;
```

### Async Hook

`afterSignIn` は async 処理にも対応しています。

```ts
hooks: {
  afterSignIn: async ({ user, session }) => {
    const value = await createExternalCredential({
      user,
      session,
    });

    return {
      value,
    };
  },
},
```

### Hook Failure

`afterSignIn` は Sign In 処理の一部として扱われます。

処理順序は以下です。

```text
authentication
      ↓
User
      ↓
Session 発行
      ↓
Session 保存
      ↓
afterSignIn
      ↓
Sign In result
```

`afterSignIn` で例外が発生した場合、Sign In 全体が失敗します。

その際、すでに保存された Session は SessionStorage から削除されます。

```text
afterSignIn error
      ↓
Session 削除
      ↓
error を呼び出し元へ伝播
```

これにより、外部認証情報などの生成に失敗したにもかかわらず、Gasboost 側の Session だけが有効な状態になることを防ぎます。

### Package Boundary

hooks API 自体は Firebase やその他の外部サービスを認識しません。

```text
@gasboost/auth
  ↓
afterSignIn
  ↓
external integration
```

例えば Firebase Custom Token を発行する場合でも、Firebase 固有の token generation は `@gasboost/auth` の責務には含めません。

```text
@gasboost/auth
      ↓
afterSignIn
      ↓
Firebase integration package
      ↓
Firebase Custom Token
```

`@gasboost/auth` は認証 lifecycle と拡張ポイントのみを提供し、外部サービス固有の処理は別 package から hook として接続します。

## Session

### Get Session

```ts
const session = await auth.session.get(sessionId);

if (!session) {
  // Session が存在しない、または期限切れ
}
```

Session は以下の情報を持ちます。

```ts
session.id;
session.userId;
session.createdAt;
session.expiresAt;
```

### Cleanup Expired Sessions

```ts
await auth.session.cleanup();
```

`PropertiesService` 使用時は期限切れ Session を削除します。

`CacheService` は自身で expiration を管理するため、cleanup は no-op です。

## Sign Out

```ts
await auth.signOut.execute(sessionId);
```

対象 Session を SessionStorage から削除します。

## Configuration

### Email / Password

```ts
emailPassword: {
  enabled: true,
  isSignupEnabled: true,
  pepper: "...",
}
```

`enabled` が `true` の場合、`pepper` は必須です。

空文字または空白だけの pepper を指定すると `AppsScriptAuth` の初期化時に失敗します。

```ts
new AppsScriptAuth({
  // ...
  emailPassword: {
    enabled: true,
    pepper: "",
  },
});
```

```text
Pepper is required when email and password authentication is enabled
```

`isSignupEnabled` を `false` にすると Sign In は許可したまま Sign Up だけを無効化できます。

```ts
emailPassword: {
  enabled: true,
  isSignupEnabled: false,
  pepper: "...",
}
```

### Apps Script

```ts
appsScript: {
  enabled: true,
  isSignupEnabled: true,
}
```

こちらも Sign In と Sign Up を個別に制御できます。

## Password

Email / Password 認証では以下を利用します。

- per-password salt
- application pepper
- iterations
- HMAC-SHA256 を利用した反復処理

現在の default iterations は `300` です。

pepper は User / Account の保存先とは分離し、Script Properties などで管理することを推奨します。

```ts
const pepper =
  PropertiesService.getScriptProperties().getProperty("AUTH_PEPPER");
```

## Testing

GAS API を利用するテストでは `gasboost/fake` を使用できます。

```bash
pnpm add -D \
  @gasboost/fake-core \
  @gasboost/fake-node
```

例:

```ts
import {
  InMemoryCacheService,
  InMemoryPropertiesService,
  InMemorySession,
} from "@gasboost/fake-core";

import { NodeUtilities } from "@gasboost/fake-node";
```

`AppsScriptAuth` の runtime に fake implementation をそのまま注入できます。

```ts
const auth = new AppsScriptAuth({
  repository,

  runtime: {
    utilities: new NodeUtilities(),
    session: fakeSession,
    cacheService: new InMemoryCacheService(),
    propertiesService: new InMemoryPropertiesService(),
  },

  session: {
    storageType: "cache",
  },
});
```

## Scope

現在の auth-core が提供するもの:

- User / Account / Session
- ProviderIdentity
- Email / Password authentication
- Apps Script Active User authentication
- Sign In
- Sign Up
- Sign Out
- Authentication lifecycle hooks (`afterSignIn`)
- Session management
- CacheService SessionStorage
- PropertiesService SessionStorage
- GAS runtime dependency injection

以下は auth-core の責務外として後続 package / Issue で扱います。

- Schema / modelName / field mapping
- database session storage
- plugin system
- admin plugin
- Google OAuth
- organization / multi-tenant
- permission model
- MCP OAuth
- frontend UI
- `@gasboost/app` middleware integration

## License

MIT

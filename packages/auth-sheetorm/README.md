# @gasboost/auth-sheetorm

`@gasboost/auth` の Repository を `@gasboost/sheetorm` で実装する adapter package です。

`@gasboost/auth` 自体は特定の Database / ORM に依存しません。

`@gasboost/auth-sheetorm` を利用すると、Auth 用の SheetORM schema と `AppsScriptAuthRepository` implementation を簡単に構築できます。

## Install

```bash
pnpm add @gasboost/auth @gasboost/auth-sheetorm @gasboost/sheetorm
```

npm:

```bash
npm install @gasboost/auth @gasboost/auth-sheetorm @gasboost/sheetorm
```

## Overview

構成は以下のようになります。

```text
@gasboost/auth
  ↓
AuthSchema
  ↓
@gasboost/auth-sheetorm
  ├─ createAuthSchema()
  └─ SheetOrmAuthRepository
        ↓
@gasboost/sheetorm
        ↓
Google Spreadsheet
```

`@gasboost/auth-sheetorm` は以下の public API を提供します。

```ts
import {
  createAuthSchema,
  SheetOrmAuthRepository,
} from "@gasboost/auth-sheetorm";
```

## Create Auth Schema

まず `@gasboost/auth` の `AuthSchemaConfig` から Auth schema を生成します。

```ts
import { AuthSchemaConfig } from "@gasboost/auth";
import { createAuthSchema } from "@gasboost/auth-sheetorm";

const authSchema = new AuthSchemaConfig({
  dbId: spreadsheetId,
}).schema;

const authTables = createAuthSchema(authSchema);
```

`createAuthSchema()` は以下の3つの `SheetTable` を生成します。

```text
User
Account
PasswordReset
```

生成される schema は `AuthSchema` の `modelName` / field mapping に従います。

## Combine with Application Schema

Auth 用 table は、application 側の SheetORM table と同じ `SheetDB` に含めることができます。

```ts
const authTables = createAuthSchema(authSchema);

const tables = [...applicationTables, ...authTables] as const;
```

その `tables` を利用して通常どおり `SheetDB` を構築します。

```ts
import { SheetDB } from "@gasboost/sheetorm";

const db = new SheetDB({
  tables,
  gateway,
  cacheService,
  utilities,
});
```

Auth 専用の `SheetDB` を別に作る必要はありません。

Application と Auth が同じ `SheetDB` を共有することで、transaction / lock の境界も共有できます。

## Create Repository

`SheetOrmAuthRepository` に `SheetDB`、Auth schema、table collection を渡します。

```ts
import { SheetOrmAuthRepository } from "@gasboost/auth-sheetorm";

const repository = new SheetOrmAuthRepository({
  db,
  schema: authSchema,
  tables,
});
```

この Repository は `@gasboost/auth` の `AppsScriptAuthRepository` contract を実装します。

内部では以下の Repository を提供します。

```text
SheetOrmAuthRepository
├─ account
├─ user
└─ passwordCredential
```

## Use with AppsScriptAuth

生成した Repository はそのまま `AppsScriptAuth` に渡せます。

```ts
import { AppsScriptAuth, AuthSchemaConfig } from "@gasboost/auth";

import {
  createAuthSchema,
  SheetOrmAuthRepository,
} from "@gasboost/auth-sheetorm";

const authSchema = new AuthSchemaConfig({
  dbId: spreadsheetId,
}).schema;

const authTables = createAuthSchema(authSchema);

const tables = [...applicationTables, ...authTables] as const;

const db = new SheetDB({
  tables,
  gateway,
  cacheService: CacheService,
  utilities: Utilities,
});

const repository = new SheetOrmAuthRepository({
  db,
  schema: authSchema,
  tables,
});

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
  },

  emailPassword: {
    enabled: true,
    pepper,
  },

  appsScript: {
    enabled: true,
  },
});
```

以降は通常の `@gasboost/auth` API を利用できます。

```ts
await auth.signUp.email({
  name: "Taro",
  email: "user@example.com",
  password: "password",
});

await auth.signIn.email({
  email: "user@example.com",
  password: "password",
});
```

## Password Reset

`createAuthSchema()` は Password Reset 用 table も生成します。

```text
PasswordReset
├─ id
├─ accountId
├─ tokenHash
├─ expiresAt
└─ enabled
```

Password Reset を有効にした場合も、同じ `SheetOrmAuthRepository` を利用できます。

```ts
const auth = new AppsScriptAuth({
  repository,
  runtime,

  session: {
    storageType: "cache",
  },

  emailPassword: {
    enabled: true,
    pepper,

    passwordReset: {
      delivery,
    },
  },
});
```

`forgot()` では Password Reset の状態を保存し、`reset()` では Account の passwordHash 更新と PasswordReset の失効を扱います。

```ts
await auth.password?.forgot({
  email: "user@example.com",
});

await auth.password?.reset({
  token,
  newPassword: "new-password",
});
```

## Schema Customization

`@gasboost/auth` の `AuthSchemaConfig` を利用して、model name や physical field name を変更できます。

```ts
const authSchema = new AuthSchemaConfig({
  dbId: spreadsheetId,

  user: {
    modelName: "authUsers",
    fields: {
      id: "userId",
      name: "displayName",
    },
  },

  account: {
    modelName: "authAccounts",
  },

  passwordReset: {
    modelName: "authPasswordResets",
  },
}).schema;
```

その schema を `createAuthSchema()` と `SheetOrmAuthRepository` の両方に渡します。

```ts
const authTables = createAuthSchema(authSchema);

const repository = new SheetOrmAuthRepository({
  db,
  schema: authSchema,
  tables,
});
```

これにより、Auth domain は physical spreadsheet schema の名前を直接認識せずに利用できます。

## Persistence

`@gasboost/auth-sheetorm` は以下を SheetORM 上に永続化します。

```text
User
Account
PasswordReset
```

Email / Password の plain password や Password Reset の plain token は保存しません。

Password については `passwordHash` のみを Account に保存します。

Password Reset token については hash のみを保存します。

## Transactions

User と Account の作成、および Password Reset 時の関連更新は、同じ `SheetDB.transaction()` 境界で扱われます。

transaction の commit / rollback semantics 自体は `@gasboost/sheetorm` の責務です。

`@gasboost/auth-sheetorm` は、その transaction 境界を利用して Auth aggregate の保存を行います。

## Responsibilities

`@gasboost/auth-sheetorm` の責務:

- Auth 用 `SheetTable` の生成
- AuthSchema と SheetORM schema の接続
- `AppsScriptAuthRepository` の SheetORM implementation
- User / Account / Identity の hydrate / persist
- PasswordCredential / PasswordReset の hydrate / persist
- Auth aggregate の transaction 境界

`@gasboost/auth-sheetorm` の責務外:

- 認証ロジックそのもの
- Password hashing
- Session management
- GAS Web App routing
- frontend UI

これらは `@gasboost/auth` または利用側 application の責務です。

## License

MIT

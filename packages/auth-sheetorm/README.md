# @gasboost/auth-sheetorm

`@gasboost/auth` の Repository を `@gasboost/sheetorm` で実装する adapter package です。
認証テーブルの論理定義は `@gasboost/auth`、`SheetTable` への具体化は application の Backend が担当します。

## Install

```bash
pnpm add @gasboost/auth @gasboost/auth-sheetorm @gasboost/sheetorm
```

## Define Shared Tables

Frontend と Backend の両方から参照できる shared module で論理テーブルを定義します。この段階では `dbId` などの storage 固有設定を含みません。

```ts
// src/shared/tables.ts
import { createAuthTables } from "@gasboost/auth";
import { defineTable } from "@gasboost/table";
import { z } from "zod";

export const authTables = createAuthTables();
export const tutorialTable = defineTable({
  name: "tutorial",
  schema: z.object({ id: z.string(), title: z.string() }),
  primaryKey: "id",
});
```

必要な definition だけを Replica などで再利用できます。

```ts
createReplica({
  name: "app",
  tables: [authTables.user, tutorialTable] as const,
});
```

## Build SheetDB

Backend の composition root で shared definition を `SheetTable` に具体化します。

```ts
// src/server/lib/db.ts
import { SheetDB, SheetTable } from "@gasboost/sheetorm";
import { authTables, tutorialTable } from "../../shared/tables";

const userTable = new SheetTable({ ...authTables.user, dbId });
const accountTable = new SheetTable({ ...authTables.account, dbId });
const passwordResetTable = new SheetTable({
  ...authTables.passwordReset,
  dbId,
});
const tutorialSheetTable = new SheetTable({
  ...tutorialTable,
  dbId,
  autoNumbering: "uuid",
});

const tables = [
  userTable,
  accountTable,
  passwordResetTable,
  tutorialSheetTable,
] as const;

export const db = new SheetDB({
  tables,
  gateway,
  cacheService: CacheService,
  utilities: Utilities,
});
```

## Create Repository

Repository は構築済みの `SheetDB` を唯一のテーブル所有者として利用します。初期化時に `tables` を重ねて渡す必要はありません。

```ts
import { SheetOrmAuthRepository } from "@gasboost/auth-sheetorm";

export const repository = new SheetOrmAuthRepository({
  db,
  schema: authTables.schema,
});
```

生成した Repository は `AppsScriptAuth` にそのまま渡せます。

```ts
const auth = new AppsScriptAuth({
  repository,
  runtime,
  session: { storageType: "cache" },
  emailPassword: { enabled: true, pepper },
  appsScript: { enabled: true },
});
```

Authorization assignment も同じ流れで `SheetOrmAuthorizationRepository` を利用できます。permission vocabulary や role definition は保存せず、`createAuthorizationTables()` が作る assignment table だけを `SheetTable` に具体化します。

```ts
import { createAuthorizationTables } from "@gasboost/auth";
import { SheetOrmAuthorizationRepository } from "@gasboost/auth-sheetorm";

export const authorizationTables = createAuthorizationTables();

const authorizationRoleTable = new SheetTable({
  ...authorizationTables.role,
  dbId,
});
const authorizationPermissionTable = new SheetTable({
  ...authorizationTables.permission,
  dbId,
});

export const authorizationRepository = new SheetOrmAuthorizationRepository({
  db,
  schema: authorizationTables.schema,
});
```

## Customize Tables

model name と physical field name は `createAuthTables()` の plain object で変更できます。解決済み mapping は `authTables.schema` から取得するため、Repository 用に同じ設定を再記述する必要はありません。

```ts
export const authTables = createAuthTables({
  user: {
    modelName: "authUsers",
    fields: { id: "userId", name: "displayName" },
  },
  account: { modelName: "authAccounts" },
  passwordReset: { modelName: "authPasswordResets" },
});
```

## Responsibilities

`@gasboost/auth-sheetorm` は User、Account、PasswordReset の hydrate / persist と transaction 境界を担当します。テーブル定義、`SheetTable` の生成、認証ロジック、password hashing、session management、routing、frontend UI は担当しません。

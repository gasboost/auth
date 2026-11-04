# @gasboost/auth-sheetorm

`0.4.0` は `@gasboost/auth` の `^0.5.0 || ^0.6.0 || ^0.7.0 || ^0.8.0` と、
`@gasboost/sheetorm` の `^3.1.0 || ^4.0.0` を peer 依存として受け入れます。

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
  lockService: LockService, // SheetORM v4で必須
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

## Account 追加（0.4.1）

`repository.account.create(account)` は既存 User に新しい Account を追加します。
`@gasboost/auth >=0.9.0` の `auth.account.add(userId, input)` に対応し、User の新規作成や
既存 Account の更新は行いません。User の存在、Account ID、Identity、同一 User の
同一方式の重複を transaction 内で検証します。`user.create()` も保存時に Identity 衝突を拒否します。

Bootstrap 用の `user.save()` は削除しました。初期化の再開・保存済み User ID の復旧は
呼び出し元が行ってください。呼び出し元で管理 API の権限確認を行ってください。
パスワード設定通知の再発行時には、同じ Account の以前のリセットリンクを無効化します。

## SheetORM 互換性の検証

通常の開発環境は SheetORM v4 を使用し、CI は v3.1 / v4.0 の両方で
型チェック・全テスト・ビルド・strict peer install付きの配布Consumer検証を実行します。
登録の結合テストでは Registration と `account.add()` から実際のSheetORMに保存し、
同じUserへの複数Account登録、通知失敗後の再発行、旧リンク拒否、
パスワード再設定後のログインを確認します。
v4では `SheetDB` に `lockService` を必ず渡してください。v3ではこのオプションは不要です。

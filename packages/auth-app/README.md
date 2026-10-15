# @gasboost/auth-app

`@gasboost/auth` と `@gasboost/app` を接続する authentication middleware adapter です。

RPC input とは独立した metadata に session token を含め、RPC 実行前に既存の `auth.session.get(token)` を利用して session を検証します。

有効な session は `AppsScript` の state に保存されます。

```text
RPC metadata["@gasboost/auth"]
   ↓
token
   ↓
@gasboost/auth-app
   ↓
auth.session.get(token)
   ↓
Session
   ↓
AppsScript state
```

`@gasboost/app` 自体は `@gasboost/auth` を認識しません。

```text
@gasboost/auth
      ↑
@gasboost/auth-app  →  @gasboost/app
```

## Install

```bash
pnpm add @gasboost/auth-app @gasboost/auth @gasboost/app
```

npm:

```bash
npm install @gasboost/auth-app @gasboost/auth @gasboost/app
```

## Auth metadata

`@gasboost/app@^5.2.0` の RPC metadata を利用します。
key / schema / validator は frontend と backend で共通の
`@gasboost/auth-client/metadata` が提供します。

```ts
import {
  AUTH_METADATA_KEY,
  type AuthMetadata,
} from "@gasboost/auth-client/metadata";

const metadata = {
  [AUTH_METADATA_KEY]: { token } satisfies AuthMetadata,
};

await app.dispatch("updateProfile", { name: "Taro" }, metadata);
```

handler input は業務入力だけを定義します。
`AuthenticatedInput<T>` は 0.4.0 で削除しました。
input の `token` は認証には使いません。旧方式との後方互換性はありません。

`@gasboost/client` では metadata provider を登録することで、
RPC ごとに token を渡さずに利用できます。
frontend では `pnpm add @gasboost/client @gasboost/auth-client` で依存を追加します。

```ts
import { appsScriptClient } from "@gasboost/client";
import { AUTH_METADATA_KEY } from "@gasboost/auth-client/metadata";

const { client } = appsScriptClient<AppType>({
  metadataProviders: [
    () => {
      const token = getCurrentToken();
      return token ? { [AUTH_METADATA_KEY]: { token } } : undefined;
    },
  ],
});

await client.updateProfile({ name: "Taro" });
```

session lifecycle 管理には `@gasboost/auth-client/appsscript` の
`appsScriptAuth({ client, storage })` と `authMetadataProvider(storage)` を利用できます。
詳細は [auth-client README](../auth-client/README.md) を参照してください。

## Authentication middleware

既存の `AppsScriptAuth` instance を `authentication()` に渡します。

session storage や repository を middleware 側で再定義する必要はありません。

```ts
import { AppsScript } from "@gasboost/app";
import { AppsScriptAuth } from "@gasboost/auth";
import { authentication } from "@gasboost/auth-app";

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
});

const app = new AppsScript().use(authentication(auth));
```

`authentication()` は `AppsScriptAuth` の既存 session API を利用します。

```ts
const session = await auth.session.get(token);
```

有効な session が取得できた場合、middleware はその session を `AppsScript` state に設定します。

`@gasboost/app` v5.2 以降では `authentication()` の適用後、後続 handler の `context.state` から session が non-nullable として取得できます。

## Auth handlers

`handlers(auth)` は `AppsScriptAuth` の公開 API を `@gasboost/app` の RPC handler として登録できる形へ変換します。

```ts
import { AppsScript } from "@gasboost/app";
import { AppsScriptAuth } from "@gasboost/auth";
import { authentication, handlers } from "@gasboost/auth-app";

const auth = new AppsScriptAuth({
  repository,
  runtime,
  session: {
    storageType: "cache",
  },
});

const app = new AppsScript().calls(handlers(auth)).use(authentication(auth));
```

以下の RPC が公開されます。

- `signInEmail`
- `signInAppsScript`
- `signUpEmail`
- `signUpAppsScript`
- `getSession`
- `signOut`

Password Reset が有効な場合は、さらに以下も公開されます。

- `forgotPassword`
- `resetPassword`

`signIn` / `signUp` / Password Reset の input と result の型は `@gasboost/auth` の既存 API から推論されます。

`getSession` と `signOut` は、RPC の単一 object input contract に合わせて以下の形式になります。

```ts
client.getSession({
  sessionId: "session-id",
});

client.signOut({
  sessionId: "session-id",
});
```

`signOut` / `forgotPassword` / `resetPassword` の RPC 成功時の result は
JSON として扱える `null` です（0.5.0 以降）。
`@gasboost/auth` 側の API 自体は変更されません。

```ts
await auth.session.get("session-id");
await auth.signOut.execute("session-id");
```

## Authorization Middleware

`authorization()` は、`authentication(auth)` が state に保存した `session.userId` を使って `AppsScriptAuthorization.can()` に委譲します。token の再検証、Session Storage へのアクセス、Repository への直接アクセスは行いません。

```ts
import {
  authentication,
  authorization as requireAuthorization,
} from "@gasboost/auth-app";

const app = new AppsScript()
  .use(authentication(auth))
  .use(
    requireAuthorization(authorization, {
      project: ["update"],
    }),
  )
  .call("updateProject", updateProject);
```

許可されない場合は `Forbidden` を throw します。認証に失敗した場合の `Unauthorized` とは区別されます。

`authorizationHandlers(authorization)` は role / permission assignment 用の handler を生成します。

```ts
const handlers = authorizationHandlers(authorization);

app.call("assignRole", handlers.role.assign);
app.call("allowPermission", handlers.permission.allow);
```

これらの handler は強い権限を持つ master operation です。自動登録や暗黙の管理権限付与は行わないため、公開する RPC 名と保護用 middleware は application 側で明示してください。

## Authenticated RPC

認証が必要な RPC は `authentication(auth)` より後に登録します。

```ts
import { AppsScript } from "@gasboost/app";
import { authentication } from "@gasboost/auth-app";

const app = new AppsScript()
  .use(authentication(auth))
  .call("getProfile", (_input, context) => {
    const session = context.state.get("session");

    return getProfile(session.userId);
  });
```

`authentication(auth)` の通過後は session が state に存在することが型として保証されるため、`undefined` check は不要です。

クライアント側では metadata provider が token を供給します。

```ts
client.getProfile();
```

追加 input が必要な場合:

```ts
const app = new AppsScript().use(authentication(auth)).call(
  "updateProfile",
  (
    input: {
      name: string;
    },
    context,
  ) => {
    const session = context.state.get("session");

    return updateProfile({
      userId: session.userId,
      name: input.name,
    });
  },
);
```

クライアント:

```ts
client.updateProfile({
  name: "Taro",
});
```

## Public RPC

middleware はすべての RPC に認証を要求するわけではありません。

公開 RPC は `authentication(auth)` より前に登録します。middleware より後の RPC は input の有無にかかわらず認証必須です。

```ts
const app = new AppsScript()
  .call("signIn", (input: { email: string; password: string }) => {
    return auth.signIn.email(input);
  })
  .use(authentication(auth));
```

クライアント側でも token は不要です。

```ts
client.signIn({
  email: "user@example.com",
  password: "password",
});
```

input 自体を持たない公開 RPC も利用できます。

```ts
const app = new AppsScript()
  .call("health", () => ({ ok: true }))
  .use(authentication(auth));
```

## Session state

認証に成功すると middleware は取得した session を `AppsScript` state に設定します。

```ts
context.state.set("session", session);
```

`authentication(auth)` より後の application handler では、`context.state` から取得できます。

```ts
const app = new AppsScript()
  .use(authentication(auth))
  .call("getProfile", (_input, context) => {
    const session = context.state.get("session");

    session.id;
    session.userId;
    session.createdAt;
    session.expiresAt;

    return getProfile(session.userId);
  });
```

`authentication(auth)` が session state を保証するため、後続 handler では `session` は `undefined` になりません。

application user が必要な場合は `session.userId` を利用して application 側で取得します。

```ts
const app = new AppsScript()
  .use(authentication(auth))
  .call("getProfile", async (_input, context) => {
    const session = context.state.get("session");
    const user = await userRepository.find(session.userId);

    return user;
  });
```

`@gasboost/auth-app` は application User の取得までは担当しません。

## Unauthorized

middleware より後に登録されたすべての RPC で auth metadata を検証します。

以下の場合は `Unauthorized` error になります。

- auth metadata が存在しない、または object ではない
- `token` が存在しない、string ではない、空文字、空白のみ
- `auth.session.get(token)` が session を返さない
- session が期限切れ

```ts
throw new Error("Unauthorized");
```

期限切れ session の判定と削除は `@gasboost/auth` の既存 `session.get()` が担当します。

middleware 側で session storage を直接操作することはありません。

## Apps Script identity

`Session.getActiveUser().getEmail()` と application session は別の概念です。

```text
Session.getActiveUser().getEmail()
            ≠
application session
```

この middleware では application の認証状態を RPC metadata の session token から確認します。

```text
token
  ↓
auth.session.get(token)
  ↓
application Session
```

Apps Script Active User を application session の代替として扱いません。

## Custom state

`@gasboost/app` v5.2 以降では middleware が追加する state は `.use()` によって型へ反映されます。

```ts
const app = new AppsScript().use(authentication(auth));
```

`authentication(auth)` より後の handler では session state が保証されます。

```ts
const app = new AppsScript()
  .calls(handlers(auth))
  .call("health", () => ({
    ok: true,
  }))
  .use(authentication(auth))
  .call("getProfile", (_input, context) => {
    const session = context.state.get("session");

    return getProfile(session.userId);
  });
```

application 独自の state を追加する場合も、対応する middleware を `.use()` で組み合わせます。

## Responsibility

`@gasboost/auth-app` が担当するもの:

- 共有 auth metadata contract の解釈
- RPC metadata から token の取得
- `auth.session.get(token)` による session 検証
- session の AppsScript state への設定
- invalid token の拒否

担当しないもの:

- session storage の構築
- repository の構築
- User の取得
- `Session.getActiveUser()` による identity 解決

これらはそれぞれ `@gasboost/auth` または application の責務です。

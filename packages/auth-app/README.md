# @gasboost/auth-app

`@gasboost/auth` と `@gasboost/app` を接続する authentication middleware adapter です。

認証必須 RPC の input に session token を含め、RPC 実行前に既存の `auth.session.get(token)` を利用して session を検証します。

有効な session は `AppsScript` の state に保存されます。

```text
RPC input
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

## AuthenticatedInput

認証が必要な RPC では `AuthenticatedInput` を handler input に指定します。

```ts
import type { AuthenticatedInput } from "@gasboost/auth-app";
```

token だけ必要な場合:

```ts
type Input = AuthenticatedInput;
```

これは以下の型になります。

```ts
type Input = {
  token: string;
};
```

追加の input がある場合は generic parameter に object を指定します。

```ts
type Input = AuthenticatedInput<{
  name: string;
}>;
```

これは以下の型になります。

```ts
type Input = {
  name: string;
  token: string;
};
```

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

`@gasboost/app` v4 では `authentication()` の適用後、後続 handler の `context.state` から session が non-nullable として取得できます。

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

const app = new AppsScript().use(authentication(auth)).calls(handlers(auth));
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

`@gasboost/auth` 側の API 自体は変更されません。

```ts
await auth.session.get("session-id");
await auth.signOut.execute("session-id");
```

## Authenticated RPC

認証が必要な RPC は `AuthenticatedInput` を利用します。

```ts
import { AppsScript } from "@gasboost/app";
import { authentication, type AuthenticatedInput } from "@gasboost/auth-app";

const app = new AppsScript()
  .use(authentication(auth))
  .call("getProfile", (_input: AuthenticatedInput, context) => {
    const session = context.state.get("session");

    return getProfile(session.userId);
  });
```

`authentication(auth)` の通過後は session が state に存在することが型として保証されるため、`undefined` check は不要です。

クライアント側では token が必須になります。

```ts
client.getProfile({
  token,
});
```

追加 input が必要な場合:

```ts
const app = new AppsScript().use(authentication(auth)).call(
  "updateProfile",
  (
    input: AuthenticatedInput<{
      name: string;
    }>,
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
  token,
  name: "Taro",
});
```

## Public RPC

middleware はすべての RPC に認証を要求するわけではありません。

token を持たない RPC input はそのまま後続 handler へ流れます。

```ts
const app = new AppsScript()
  .use(authentication(auth))
  .call("signIn", (input: { email: string; password: string }) => {
    return auth.signIn.email(input);
  });
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
const app = new AppsScript().use(authentication(auth)).call("health", () => {
  return {
    ok: true,
  };
});
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
  .call("getProfile", (_input: AuthenticatedInput, context) => {
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
  .call("getProfile", async (_input: AuthenticatedInput, context) => {
    const session = context.state.get("session");
    const user = await userRepository.find(session.userId);

    return user;
  });
```

`@gasboost/auth-app` は application User の取得までは担当しません。

## Unauthorized

token プロパティが存在する場合、middleware は token を検証します。

以下の場合は `Unauthorized` error になります。

- `token` が string ではない
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

この middleware では application の認証状態を RPC input の session token から確認します。

```text
token
  ↓
auth.session.get(token)
  ↓
application Session
```

Apps Script Active User を application session の代替として扱いません。

## Custom state

## Custom state

`@gasboost/app` v4 では middleware が追加する state は `.use()` によって型へ反映されます。

```ts
const app = new AppsScript().use(authentication(auth));
```

`authentication(auth)` より後の handler では session state が保証されます。

```ts
const app = new AppsScript()
  .use(authentication(auth))
  .call("getProfile", (_input: AuthenticatedInput, context) => {
    const session = context.state.get("session");

    return getProfile(session.userId);
  });
```

application 独自の state を追加する場合も、対応する middleware を `.use()` で組み合わせます。

## Responsibility

`@gasboost/auth-app` が担当するもの:

- authenticated RPC input の token contract
- RPC input から token の取得
- `auth.session.get(token)` による session 検証
- session の AppsScript state への設定
- invalid token の拒否

担当しないもの:

- session storage の構築
- repository の構築
- User の取得
- authorization
- `Session.getActiveUser()` による identity 解決

これらはそれぞれ `@gasboost/auth` または application の責務です。

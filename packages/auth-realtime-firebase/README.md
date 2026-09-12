# @gasboost/auth-realtime-firebase

Firebase Authentication integration adapter for `@gasboost/auth`.

`@gasboost/auth` の認証 lifecycle と、`@gasboost/realtime-firebase` の Firebase Custom Token generation を接続します。

```text
@gasboost/auth
      ↓ afterSignIn
@gasboost/auth-realtime-firebase
      ↓
@gasboost/realtime-firebase
      ↓
Firebase Custom Token
```

## Install

```bash
pnpm add \
  @gasboost/auth \
  @gasboost/auth-realtime-firebase \
  @gasboost/realtime-firebase
```

## Usage

```ts
import { AppsScriptAuth, type EmailPasswordAuthOptions } from "@gasboost/auth";
import {
  FirebaseAuthHook,
  type FirebaseAuthHookResult,
} from "@gasboost/auth-realtime-firebase";

const firebase = new FirebaseAuthHook({
  serviceAccount: {
    email: serviceAccountEmail,
    privateKey,
  },

  utilities: Utilities,
});

const auth = new AppsScriptAuth<
  EmailPasswordAuthOptions,
  FirebaseAuthHookResult
>({
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

  hooks: {
    afterSignIn: firebase.afterSignIn,
  },
});
```

Sign In result から Firebase Custom Token を取得できます。

```ts
const result = await auth.signIn.email({
  email: "user@example.com",
  password: "password",
});

result.user;
result.session;
result.hooks.customToken;
```

## UID

Gasboost Auth の `User.id` を Firebase Authentication の `uid` として利用します。

```text
Auth User.id
    ↓
Firebase uid
```

adapter側で別のFirebase User IDを管理する必要はありません。

## Custom Claims

`claims` を指定すると Firebase Custom Token の custom claims を生成できます。

```ts
const firebase = new FirebaseAuthHook({
  serviceAccount: {
    email: serviceAccountEmail,
    privateKey,
  },

  utilities: Utilities,

  claims: ({ user, session }) => ({
    storeId: "store-1",
    authSessionId: session.id,
  }),
});
```

生成されたclaimsはFirebase Authentication後、

```text
auth.token.storeId
```

などとしてFirebase Security Rulesから参照できます。

## Service Account

Firebase Custom Token は Google Service Account によって署名する必要があります。

このpackageでは `@gasboost/realtime-firebase` のローカル署名方式を利用するため、以下が必要です。

```ts
serviceAccount: {
  email: serviceAccountEmail,
  privateKey,
}
```

private key はソースコードへ直接埋め込まず、安全なcredential storageから取得してください。

Service Account credentialの保存やSecret Manager integrationは、このpackageの責務ではありません。

## GAS Utilities

署名処理にはGoogle Apps Script標準の `Utilities` を利用できます。

```ts
const firebase = new FirebaseAuthHook({
  serviceAccount,
  utilities: Utilities,
});
```

公開APIはGAS固有型には依存していないため、実際の署名処理は `@gasboost/realtime-firebase` が要求する最小interfaceを通じて実行されます。

## Client

Sign Inで取得したCustom Tokenはfrontendへ返し、Firebase公式SDKへ渡します。

```ts
import { getAuth, signInWithCustomToken } from "firebase/auth";

await signInWithCustomToken(getAuth(), result.hooks.customToken);
```

このpackageはFirebase Browser SDKをラップしません。

## Package Boundary

このpackageが担当するのは integration のみです。

```text
AfterSignInContext
   ├─ User
   └─ Session
        ↓
FirebaseAuthHook
        ↓
uid / claims
        ↓
FirebaseCustomToken.generate()
```

以下は担当しません。

- Gasboost Auth の認証処理
- Firebase Custom Token JWT生成ロジック
- Firebase Admin SDK
- Firebase Browser SDK
- `signInWithCustomToken()` の実行
- Firebase Auth session管理
- Service Account credential storage
- Secret Manager integration

## License

MIT

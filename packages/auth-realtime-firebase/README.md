# @gasboost/auth-realtime-firebase

`0.2.0` は `@gasboost/auth@0.7.0` と組み合わせるリリースです。
Sign In / Sign Up 共通の `afterSignIn` と、認証済み Session からの Custom Token 再発行RPCを提供します。

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
  @gasboost/app \
  @gasboost/auth \
  @gasboost/auth-app \
  @gasboost/auth-realtime-firebase \
  @gasboost/realtime-firebase
```

`@gasboost/app@^5.2.0` / `@gasboost/auth-app@^0.6.0` は peer dependency です。

## Backend

```ts
import { AppsScript, type InferAppsScript } from "@gasboost/app";
import { AppsScriptAuth, type EmailPasswordAuthOptions } from "@gasboost/auth";
import { authentication, handlers } from "@gasboost/auth-app";
import {
  FirebaseAuthHook,
  firebaseAuthHandlers,
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

const app = new AppsScript()
  .calls(handlers(auth))
  .use(authentication(auth))
  .calls(firebaseAuthHandlers(firebase));
export type AppType = InferAppsScript<typeof app>;
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

検証済み GAS Session の `session.userId` を Firebase Authentication の `uid` として利用します。

```text
GAS Session.userId（アプリケーション User ID）
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

  claims: ({ session }) => ({
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

## 0.1.x からの移行

`FirebaseAuthHook.afterSignIn` の名前と `{ customToken: string }` の戻り値は維持します。
既存の `AppsScriptAuth({ hooks: { afterSignIn: firebase.afterSignIn } })` はそのまま使えます。
`afterSignIn({ session })` と直接呼ぶこともできます。

**`claims` callback の引数は `{ user, session }` から `{ session }` に変わります。**
公開型 `FirebaseAuthContext` も Session だけを持ち、UID は `session.userId` から決めます。
`claims: ({ user }) => ...` は型エラーになるため、Sessionから生成できるClaimsに変更してください。
Sessionから生成できないUser依存Claimsは、この再発行モデルでは利用できません。
UserのRepository参照や再取得は追加していません。User依存Claimsが必要な場合は別の設計が必要です。

## Custom Token 再発行RPC

`firebaseAuthHandlers(firebase)` は固定名 `issueFirebaseCustomToken` のHandler Mapを返します。
認証済み `AuthState` を必要とするため、`authentication(auth)` より後に登録してください。
前に登録すると型エラーになります。実行時も認証middlewareが未認証・期限切れSessionを拒否します。

RPCは引数なしで呼びます。`userId` / `sessionId` / Session をリクエストで指定できません。
UIDは必ずmiddlewareが検証した `context.state.get("session").userId` から決まります。
型を迂回してinputを送った場合も、そのinputは発行主体に採用しません。

再発行は既存の `firebase.afterSignIn({ session })` に委譲し、初回認証と同じ署名・Claims設定を使います。
新しいGAS Sessionの作成、GASユーザーの再認証、DBからのUser取得は行いません。
署名やClaims生成が失敗した場合は例外を呼び出し元へ伝搬します。
秘密鍵はbackendだけで保持してください。

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

## Frontend

`@gasboost/auth-client@^0.4.0` / `@gasboost/client@^0.5.0` と Firebase SDK はConsumerに追加します。
上記backendの `AppType` と、同じstorageを利用してtyped RPC clientを作成します。

```ts
import { memoryAuthStorage } from "@gasboost/auth-client";
import {
  appsScriptAuth,
  authMetadataProvider,
} from "@gasboost/auth-client/appsscript";
import { appsScriptClient } from "@gasboost/client";
import {
  getAuth,
  signInWithCustomToken,
  signOut as firebaseSignOut,
} from "firebase/auth";
import type { AppType } from "../backend/main";

const firebaseAuth = getAuth();
// 永続化する場合は localStorageAuthStorage() 等に置き換えます。
const storage = memoryAuthStorage();
const { client } = appsScriptClient<AppType>({
  transport,
  metadataProviders: [authMetadataProvider(storage)],
});
const auth = appsScriptAuth({
  client,
  storage,
  getUserId: (result) => result.session.userId,
  hooks: {
    afterSignIn: async ({ hooks }) => {
      await signInWithCustomToken(firebaseAuth, hooks.customToken);
    },
  },
  externalAuth: {
    getUserId: async () => {
      await firebaseAuth.authStateReady();
      return firebaseAuth.currentUser?.uid ?? null;
    },
    signIn: async (_expectedUserId) => {
      const { customToken } = await client.issueFirebaseCustomToken();
      await signInWithCustomToken(firebaseAuth, customToken);
    },
    signOut: () => firebaseSignOut(firebaseAuth),
  },
});

const { session, synchronized } = await auth.sync();
const isAuthenticated = session !== null && synchronized;
```

`issueFirebaseCustomToken` はCustom Tokenを発行するRPCです。
Firebaseへのサインイン・セッション確立はConsumerのSDK `signInWithCustomToken()` が担当します。
このpackageはFirebase Browser SDKをラップしません。Custom Tokenは永続storageに保存しないでください。

GAS Sessionが有効でFirebaseだけ未認証・別ユーザーなら、`auth.sync()` が再発行RPCとSDKで修復します。
修復後のID再照合、例外伝搬、競合制御は `auth-client` が担当します。
同期失敗を理由に有効なGAS Sessionを破棄しません。

## Package Boundary

このpackageが担当するのは integration のみです。

```text
FirebaseAuthContext
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

# @gasboost/auth-client

frontend framework / transport 非依存の認証 session lifecycle と、
Gasboost 標準 auth RPC 向けの Apps Script adapter を提供します。

## Install

```bash
pnpm add @gasboost/auth-client @gasboost/client
```

Apps Script adapter は `@gasboost/client@^0.5.0` の metadata pipeline と互換です。
backend は `@gasboost/auth-app@^0.6.0` と `@gasboost/app@^5.2.0` を使用します。
root と `/metadata` は RPC client や browser globals を使わず import できます。

## Apps Script consumer

同じ storage instance を metadata provider と auth に渡します。

```ts
import { localStorageAuthStorage } from "@gasboost/auth-client";
import {
  appsScriptAuth,
  authMetadataProvider,
} from "@gasboost/auth-client/appsscript";
import { appsScriptClient } from "@gasboost/client";
import type { AppType } from "../backend/main";

const storage = localStorageAuthStorage();

export const { client } = appsScriptClient<AppType>({
  transport,
  metadataProviders: [authMetadataProvider(storage)],
});

export const auth = appsScriptAuth({ client, storage });

const session = await auth.signIn({ email, password });
session.token; // server の session.id
session.user;
session.session;
// server が afterSignIn hook を設定している場合、その result と型も保持します。

await client.createEmployee({ name, email });
await auth.signOut();
```

RPC client の生成は consumer の責務です。
provider は RPC 実行時に storage を読み、
`{ "@gasboost/auth": { token } }` を返します。
token がない場合や空白のみの場合は metadata を返しません。
業務 input に token を追加したり、認証対象 RPC 名を列挙したりする必要はありません。
backend の公開 auth RPC は `authentication(auth)` より前に登録します。

## ExternalAuth と Consumer Hook（Firebase の例）

backend で Firebase Custom Token を返す設定にします。`repository` / `runtime` /
`sessionConfig` / `emailPasswordOptions` は既存のサーバー設定です。

```ts
import { AppsScriptAuth } from "@gasboost/auth";
import type { InferAppsScript } from "@gasboost/app";
import { authentication, handlers } from "@gasboost/auth-app";
import { FirebaseCustomToken } from "@gasboost/realtime-firebase";
import { FirebaseAuthHook } from "@gasboost/auth-realtime-firebase";

const serviceAccount = { email: serviceAccountEmail, privateKey };
const firebaseHook = new FirebaseAuthHook({
  serviceAccount,
  utilities: Utilities,
});
const auth = new AppsScriptAuth({
  repository,
  runtime,
  session: sessionConfig,
  emailPassword: emailPasswordOptions,
  hooks: { afterSignIn: firebaseHook.afterSignIn },
});
// 既存の AppsScript app へ登録し、その型を frontend に渡します。
const authApp = app
  .calls(handlers(auth))
  .use(authentication(auth))
  .call("issueFirebaseCustomToken", (_: Record<string, never>, context) => {
    // middleware が検証した Session の User ID だけを使います。
    const session = context.state.get("session");
    return {
      customToken: FirebaseCustomToken.generate({
        uid: session.userId,
        serviceAccount,
        utilities: Utilities,
      }),
    };
  });
export type AppType = InferAppsScript<typeof authApp>;
```

frontend は上記 app の型で作成した `client` と共有 `storage` を使用します。
明示的な型引数やキャストなしで、RPC の戻り値から `hooks` を推論します。

```ts
import { appsScriptAuth } from "@gasboost/auth-client/appsscript";
import {
  signInWithCustomToken,
  signOut as firebaseSignOut,
} from "firebase/auth";

export const auth = appsScriptAuth({
  client,
  storage,
  hooks: {
    afterSignIn: async ({ hooks }) => {
      await signInWithCustomToken(firebaseAuth, hooks.customToken);
    },
    afterSignOut: () => {
      queryClient.clear(); // Consumer が用意した TanStack Query の QueryClient
    },
  },
  getUserId: (result) => result.session.userId,
  externalAuth: {
    getUserId: async () => {
      await firebaseAuth.authStateReady();
      return firebaseAuth.currentUser?.uid ?? null;
    },
    signIn: async (_expectedUserId) => {
      // クライアントから User ID を指定せず、現在の GAS Session で再発行します。
      const { customToken } = await client.issueFirebaseCustomToken({});
      await signInWithCustomToken(firebaseAuth, customToken);
    },
    signOut: () => firebaseSignOut(firebaseAuth),
  },
});

const signedUp = await auth.signUp({ name, email, password });
signedUp.hooks.customToken; // string
const signedIn = await auth.signIn({ email, password });
signedIn.hooks.customToken; // string

const { session, synchronized } = await auth.sync();
const isAuthenticated = session !== null && synchronized;
```

GAS=A / Firebase=null・B を修復するには、上記のような Custom Token の再発行RPCが必要です。
再発行RPCは `authentication(auth)` の後に登録し、リクエストで任意の User ID を受け取らず、
検証済み Session の `userId` から署名します。Custom Claims を設定する場合も、
サインイン時と再発行時で同じ認可方針に従ってください。
Firebase SDK と再発行RPCは Consumer が用意し、`auth-client` 本体はどちらも import / wrap しません。

`afterSignIn` を Sign In / Sign Up（email / Apps Script）の両方で1回 await し、
成功後に token を保存して state を通知します。引数は `{ user, session, token, hooks }` 等の
認証結果全体です。サーバー Hook がない場合は `hooks` プロパティもなく、Consumer Hook 自体は実行できます。
Consumer Hook 未指定時は従来どおり動作します。`authClient({ remote, storage, hooks })` でも
同じ汎用 Hook を利用できます。

`afterSignOut?: () => void | Promise<void>` は明示的な `signOut()` で local storage / state を
破棄し、設定されている `externalAuth.signOut()` が成功した後に、引数なしで1回 await します。
token がない場合も実行します。新しい認証操作や storage の変更で古い Sign Out が無効化された場合や、
server / storage / 外部認証の解除が失敗した場合は実行しません。
Hook の例外・rejection は `signOut()` の呼び出し元へ伝搬し、解除済みの Session は復元しません。
`restoreSession()` / `sync()` やセッション期限切れによる解除では実行しません。

`afterSignIn` 失敗時は今回発行された session の `remote.signOut(token)` を await し、
元の Hook エラーで認証 Promise を reject します。既存の local state / storage は維持します。
失効 RPC 自体が失敗した場合も元のエラーを返し、サーバー Session が残る可能性があります。
呼び出し元はエラーを表示し、必要に応じて再認証してください。Sign Up RPC は自動再実行しません。
登録済み User / Account は残るので、再認証には Sign In を使ってください。
Consumer が開始した外部 SDK の副作用は自動で取り消せません。

RPC 完了時点で新しい認証操作が始まっていれば古い Consumer Hook は実行しません。
Hook 待機中に新しい操作が始まった場合も、完了後に古い結果で state を上書きしません。
`restoreSession` / `sync` / `signOut` では `afterSignIn` を実行しません。

永続 storage に保存するのは `session.id` のみです。Custom Token は Consumer の Firebase SDK に渡し、
永続化しないでください。Firebase SDK は Consumer が依存を追加します。
Service Account の秘密鍵は backend にのみ置き、ブラウザへ配布しないでください。

## Lifecycle

```ts
await auth.signIn({ email, password });
await auth.signUp({ name, email, password });
await auth.signInAppsScript();
await auth.signUpAppsScript({ name });
await auth.restoreSession(); // GAS 側だけを復元
const { session, synchronized } = await auth.sync(); // GAS 復元 → 外部同期
if (session && synchronized) {
  // 外部認証も必要な業務画面を表示
}
await auth.signOut();
```

signIn / signUp は server の result に `token: result.session.id` を追加して返します。
成功時は token を storage に保存してから state を更新し、購読者へ通知します。

`restoreSession()` は保存済み token を標準 `getSession({ sessionId })` RPC で検証します。
token がなければ RPC を呼びません。無効・期限切れなら storage / state を破棄します。
有効なら `{ token, session, user: null }` を復元します。
標準 `getSession` は User を返さないため、復元後の `getUser()` は `null` です。
必要な user 情報は application の RPC で取得してください。
RPC の JSON result は通常の data object として扱います。

`externalAuth` は任意指定です。指定する場合は、`getUserId(session): string` も渡します。
抽出関数は復元時と Sign In / Sign Up 時の Session に対応する必要があります。
Apps Script では `result.session.userId` を利用でき、RPC の戻り値から型推論します。
`ExternalAuth` は root から export する汎用 interface です。

```ts
interface ExternalAuth {
  getUserId(): Promise<string | null>;
  signIn(userId: string): Promise<void>;
  signOut(): Promise<void>;
}
```

外部 ID は Consumer がアプリケーション User ID に正規化してください。
Firebase のこの例では `Firebase uid === GAS User.id` です。
`signIn(userId)` は、必要なら現在の外部ユーザーを指定ユーザーへ切り替える契約です。
SDK が切替前の signOut を必要とする場合は Adapter 内で行います。

`isSynced()` は復元済みの現在の GAS Session と `externalAuth.getUserId()` を照合するだけです。
GAS の復元・検証や、外部認証の signIn / signOut は行いません。
起動直後の local state は未認証なので、保存済み token の検証には先に `restoreSession()`、
または修復を含む `sync()` を使います。

`sync()` は GAS Session の検証・復元後、ID を比較して次の修復を実施し、
`{ session, synchronized }` を返します。

| GAS User ID | 外部 User ID | 動作                  |
| ----------- | ------------ | --------------------- |
| null        | null         | 変更なし              |
| null        | A            | 外部 signOut          |
| A           | null         | 外部 signIn(A)        |
| A           | A            | 変更なし              |
| A           | B            | 外部 signIn(A) で切替 |

修復後は外部 ID を再取得し、一致する場合だけ `synchronized: true` を返します。
不一致なら `false`、SDK / RPC / storage の失敗は例外として伝搬します。
同期失敗や外部 ID の不一致を理由に、有効な GAS Session を signOut / revoke しません。
両方 null は同期済みですが認証済みではありません。
`getState().isAuthenticated` は従来どおり GAS 側だけの状態です。
外部認証も必要な Consumer は `session !== null && synchronized` を判定してください。
`externalAuth` 未指定なら `isSynced()` / `sync()` の同期判定は true です（競合時を除く）。

`signOut()` は保存済み token で server session を失効させ、storage / state の解除後に
`externalAuth.signOut()` を await します。token がない場合も外部認証を解除します。
GAS 側の失敗時は既存の状態を維持し、外部 signOut を呼びません。
外部 signOut が失敗した場合は例外を伝搬し、GAS 側の解除はロールバックしません。
`restoreSession()` や `afterSignIn` 失敗時の revoke は外部認証を解除しません。

同じ auth instance では最後に開始した認証操作だけが local state を更新します。
`sync()` / `isSynced()` の比較が重なった場合も、古い比較を成功扱いしません。
`isSynced()` は進行中の Sign In / Sign Up を取り消しません。
同期中の認証操作や共有 storage の token 変更で古くなった処理は、未実行の外部操作を
スキップし、`synchronized: false` / `false` を返します。
`sync()` の `session` はその呼び出しの復元結果です。古い `signOut()` も外部解除をスキップします。
開始済みの SDK / RPC の副作用は取り消せず、古い操作の例外も伝搬します。
必要なら最新の状態で `sync()` を再実行してください。
同期は呼び出し時点の1回限りで、後から発生する外部ログアウトの監視は行いません。
リアルタイム監視が必要なら Consumer が SDK のイベントを購読してください。

Password Reset が有効な場合は元の typed client の
`client.forgotPassword({ email })` / `client.resetPassword({ token, newPassword })` を利用します。

## State and subscriptions

```ts
const unsubscribe = auth.subscribe((state) => {
  state.session;
  state.user;
  state.token;
  state.isAuthenticated;
});
auth.getState();
auth.getSession();
auth.getUser();
auth.getToken();
unsubscribe();
```

subscribe は変更時に通知し、現在値は `getState()` で取得します。
snapshot は変更時に新しい readonly object になります。
購読者が throw しても commit 済みの state と他の購読者への通知を維持します。
初期 state は保存済み token があっても未認証です。
起動時は consumer / framework adapter から `await auth.restoreSession()`、
外部認証の同期も必要なら `await auth.sync()` を呼びます。
loading / error 表示は framework adapter が Promise から管理できます。

## Storage

root から以下を export します。

- `memoryAuthStorage()`: instance ごとに独立した memory
- `localStorageAuthStorage({ key?, storage? })`: browser の localStorage
- `sessionStorageAuthStorage({ key?, storage? })`: browser の sessionStorage
- `AuthStorage`: 同期の `get(): string | null` / `set(token: string): void` / `remove(): void`

各 factory は新しい instance を返します。
browser instance は同じ backing storage / key の内容を共有します。
既定 key は `"@gasboost/auth"` です。用途を分ける場合は key を指定します。
browser globals は factory 呼び出し時だけ参照します。
storage が存在しない場合やアクセスに失敗した場合はエラーを伝搬します。
SSR では memory または `storage` option に browser 互換実装を渡してください。
別タブの storage event による自動同期は行いません。
custom storage も同じ interface を実装して注入できます。

## Transport-independent core

```ts
import {
  authClient,
  type AuthRemote,
  type AuthSession,
} from "@gasboost/auth-client";

type Session = AuthSession<{ id: string; name: string }>;
type Credentials = { email: string; password: string };
type Registration = Credentials & { name: string };

const remote: AuthRemote<Session, Credentials, Registration> = {
  signIn: (input) => customApi.signIn(input),
  signUp: (input) => customApi.signUp(input),
  getSession: (token) => customApi.getSession(token),
  signOut: (token) => customApi.signOut(token),
};

const auth = authClient({ remote, storage });
```

AuthRemote は token と正規化済み session (`{ token, user }`) のやり取りだけを定義します。
signIn / signUp と restore の result が異なる場合もそれぞれの型を推論します。
第4・第5型引数で signIn / signUp result を明示することもできます。
`AuthClient` / `AuthSession` / `AuthState` / `AuthListener` も root から export します。

remote operation を使わず state / storage の同期だけを組み込む場合は
`authCore<Session>({ storage })` の `setSession(session | null)` と
getters / subscribe を利用できます。
Apps Script mapping 単体は `/appsscript` の `appsScriptAuthRemote({ client })` から取得できます。
通常は `appsScriptAuth({ client, storage })` を使います。

## Shared metadata contract

既存の `@gasboost/auth-client/metadata` entry point の
`AUTH_METADATA_KEY` / `AuthMetadata` / `isAuthMetadata` を維持します。
frontend provider と backend の `@gasboost/auth-app` はこの共通 contract を利用します。
この entry point は auth lifecycle / browser storage / RPC client に依存しません。
`@gasboost/auth` core には frontend / RPC metadata の概念を追加しません。
React / Vue / Svelte adapter はこの package の lifecycle と購読 API に接続します。

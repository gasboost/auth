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

## Consumer Hook（Firebase の例）

backend で Firebase Custom Token を返す設定にします。`repository` / `runtime` /
`sessionConfig` / `emailPasswordOptions` は既存のサーバー設定です。

```ts
import { AppsScriptAuth } from "@gasboost/auth";
import { handlers } from "@gasboost/auth-app";
import { FirebaseAuthHook } from "@gasboost/auth-realtime-firebase";

const firebaseHook = new FirebaseAuthHook({
  serviceAccount: { email: serviceAccountEmail, privateKey },
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
app.calls(handlers(auth));
```

frontend は上記 app の型で作成した `client` と共有 `storage` を使用します。
明示的な型引数やキャストなしで、RPC の戻り値から `hooks` を推論します。

```ts
import { appsScriptAuth } from "@gasboost/auth-client/appsscript";
import { signInWithCustomToken, signOut } from "firebase/auth";

export const auth = appsScriptAuth({
  client,
  storage,
  hooks: {
    afterSignIn: async ({ hooks }) => {
      await signInWithCustomToken(firebaseAuth, hooks.customToken);
    },
    sync: async (restored) => {
      await firebaseAuth.authStateReady();
      // 外部認証がない場合や uid が不一致の場合、表示可否や再認証は Consumer が判断します。
      return restored === null
        ? firebaseAuth.currentUser === null
        : firebaseAuth.currentUser?.uid === restored.session.userId;
    },
    afterSignOut: () => signOut(firebaseAuth),
  },
});

const signedUp = await auth.signUp({ name, email, password });
signedUp.hooks.customToken; // string
const signedIn = await auth.signIn({ email, password });
signedIn.hooks.customToken; // string
```

同じ Consumer Hook を Sign In / Sign Up（email / Apps Script）の両方で1回 await し、
成功後に token を保存して state を通知します。引数は `{ user, session, token, hooks }` 等の
認証結果全体です。サーバー Hook がない場合は `hooks` プロパティもなく、Consumer Hook 自体は実行できます。
Consumer Hook 未指定時は従来どおり動作します。`authClient({ remote, storage, hooks })` でも
同じ汎用 Hook を利用できます。

Consumer Hook 失敗時は今回発行された session の `remote.signOut(token)` を await し、
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

`sync()` は `restoreSession()` と同じ GAS Session の検証・復元を行った後、
`hooks.sync(session)` を await し、`{ session, synchronized }` を返します。
Hook 引数は復元結果または `null` で、`boolean | Promise<boolean>` を返します。
Apps Script adapter では `session.session.userId` などを `getSession` RPC から型推論します。
Hook 未指定時は `synchronized: true` です。
Hook が `false` を返す場合や throw / reject する場合も、有効な GAS Session は維持し、
自動 signOut / revoke は行いません。例外は呼び出し元へ伝搬します。
`getState().isAuthenticated` は GAS 側だけの認証状態です。
外部認証も必要な Consumer は `session` と `synchronized` を確認してください。
外部 SDK の復元待ち、照合、再同期、認証情報の取得・永続化は Consumer の責務です。
Firebase を含む外部 SDK の adapter / dependency はこの package に追加しません。

`signOut()` は state の復元前でも保存済み token を使い、server session の破棄に成功してから
storage / state を消去し、`hooks.afterSignOut()`（`void | Promise<void>`）を await します。
token がない場合も明示的な `signOut()` では外部 Hook を実行します。
通信エラーでは既存の storage / state を維持して再試行でき、外部 Hook は呼びません。
外部 Hook が失敗した場合は例外を伝搬し、GAS 側の解除はロールバックしません。
`restoreSession()` / `sync()` や `afterSignIn` 失敗時の revoke では `afterSignOut` を呼びません。
remote / storage エラーは呼び出し元へ伝搬します。

同じ auth instance で操作が重なった場合、最後に開始した操作だけが local state を更新します。
先行する操作の Promise は remote 結果を返しますが、新しい local state は上書きしません。
`sync()` が別の認証操作や共有 storage の token 変更で古くなった場合は、
未実行の `hooks.sync` をスキップし、`synchronized: false` を返します。
Hook 待機中に古くなった場合も `synchronized: false` です。`session` はその呼び出しの復元結果です。
古くなった `signOut()` は `afterSignOut` をスキップします。
開始済みの外部 Hook の副作用や進行中の server RPC 自体は取り消せません。
古くなった Hook が失敗した場合も例外を伝搬します。

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

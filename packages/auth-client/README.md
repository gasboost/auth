# @gasboost/auth-client

frontend framework / transport 非依存の認証 session lifecycle と、
Gasboost 標準 auth RPC 向けの Apps Script adapter を提供します。

## Install

```bash
pnpm add @gasboost/auth-client @gasboost/client
```

Apps Script adapter は `@gasboost/client@^0.5.0` の metadata pipeline と互換です。
backend は `@gasboost/auth-app@^0.4.1` と `@gasboost/app@^5.2.0` を使用します。
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

## Lifecycle

```ts
await auth.signIn({ email, password });
await auth.signUp({ name, email, password });
await auth.signInAppsScript();
await auth.signUpAppsScript({ name });
await auth.restoreSession();
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

`signOut()` は state の復元前でも保存済み token を使い、server session の破棄に成功してから
storage / state を消去します。通信エラーでは既存の storage / state を維持して再試行できます。
remote / storage エラーは呼び出し元へ伝搬します。

同じ auth instance で操作が重なった場合、最後に開始した操作だけが local state を更新します。
先行する操作の Promise は remote 結果を返しますが、新しい local state は上書きしません。
進行中の server RPC 自体は取り消しません。

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
起動時は consumer / framework adapter から `await auth.restoreSession()` を呼びます。
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

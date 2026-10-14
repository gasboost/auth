# @gasboost/auth-client

Frontend framework に依存しない auth metadata contract です。
この段階では `@gasboost/auth-client/metadata` のみを公開します。
`createAuthClient`、session lifecycle、storage、subscribe は Issue #37 で追加します。

```ts
import {
  AUTH_METADATA_KEY,
  type AuthMetadata,
} from "@gasboost/auth-client/metadata";

const metadata = {
  [AUTH_METADATA_KEY]: { token: "session-token" } satisfies AuthMetadata,
};
```

`@gasboost/auth-app` もこの key / schema / validator を使用します。
この entry point は server-side auth、Apps Script、RPC framework に依存しません。
`isAuthMetadata(value)` は object 内の空白以外を含む string token を検証します。

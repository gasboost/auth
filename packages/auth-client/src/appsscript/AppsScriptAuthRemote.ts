/** Structural contract of the existing handlers(auth) RPCs. */
export interface AppsScriptAuthRpc {
  signInEmail(input: { email: string; password: string }): Promise<{
    user: unknown;
    session: { id: string };
  }>;
  signUpEmail(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<{
    user: unknown;
    session: { id: string };
  }>;
  signInAppsScript(input: Record<string, never>): Promise<{
    user: unknown;
    session: { id: string };
  }>;
  signUpAppsScript(input: { name: string }): Promise<{
    user: unknown;
    session: { id: string };
  }>;
  getSession(input: { sessionId: string }): Promise<{ id: string } | null>;
  signOut(input: { sessionId: string }): Promise<unknown>;
}

type SignInInput<TClient extends AppsScriptAuthRpc> =
  | { provider: "email"; input: Parameters<TClient["signInEmail"]>[0] }
  | {
      provider: "appsScript";
      input: Parameters<TClient["signInAppsScript"]>[0];
    };

type SignUpInput<TClient extends AppsScriptAuthRpc> =
  | { provider: "email"; input: Parameters<TClient["signUpEmail"]>[0] }
  | {
      provider: "appsScript";
      input: Parameters<TClient["signUpAppsScript"]>[0];
    };

function withToken<TResult extends { user: unknown; session: { id: string } }>(
  result: TResult,
) {
  return { ...result, token: result.session.id };
}

export function appsScriptAuthRemote<TClient extends AppsScriptAuthRpc>({
  client,
}: {
  client: TClient;
}) {
  return {
    async signIn({ provider, input }: SignInInput<TClient>) {
      if (provider === "appsScript") {
        return withToken(
          (await client.signInAppsScript(input)) as Awaited<
            ReturnType<TClient["signInAppsScript"]>
          >,
        );
      }
      return withToken(
        (await client.signInEmail(input)) as Awaited<
          ReturnType<TClient["signInEmail"]>
        >,
      );
    },
    async signUp({ provider, input }: SignUpInput<TClient>) {
      if (provider === "appsScript") {
        return withToken(
          (await client.signUpAppsScript(input)) as Awaited<
            ReturnType<TClient["signUpAppsScript"]>
          >,
        );
      }
      return withToken(
        (await client.signUpEmail(input)) as Awaited<
          ReturnType<TClient["signUpEmail"]>
        >,
      );
    },
    async signOut(token: string): Promise<void> {
      await client.signOut({ sessionId: token });
    },
    async getSession(token: string) {
      const session = (await client.getSession({
        sessionId: token,
      })) as Awaited<ReturnType<TClient["getSession"]>>;
      // The standard getSession RPC returns no user. Do not fabricate one.
      return session === null
        ? null
        : { token: session.id, user: null, session };
    },
  };
}

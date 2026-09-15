import type { AppType } from "../backend/passwordreset-enabled";

type Client<T> = {
  [K in keyof T]: T[K] extends {
    input: infer TInput;
    result: infer TResult;
  }
    ? TInput extends undefined
      ? () => Promise<TResult>
      : (input: TInput) => Promise<TResult>
    : never;
};

declare const client: Client<AppType>;

client.signInEmail({
  email: "user@example.com",
  password: "password",
});

client.getSession({
  sessionId: "session-id",
});
client.signOut({
  sessionId: "session-id",
});

client.forgotPassword({
  email: "user@example.com",
});

client.resetPassword({
  token: "token",
  newPassword: "new-password",
});

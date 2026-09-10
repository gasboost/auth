import type { AppType } from "../backend/passwordreset-enabled";

type Client<T> = {
  [K in keyof T]: T[K] extends {
    args: infer TArgs extends unknown[];
    result: infer TResult;
  }
    ? (...args: TArgs) => Promise<TResult>
    : never;
};

declare const client: Client<AppType>;

client.signInEmail({
  email: "user@example.com",
  password: "password",
});

client.getSession("session-id");
client.signOut("session-id");

client.forgotPassword({
  email: "user@example.com",
});

client.resetPassword({
  token: "token",
  newPassword: "new-password",
});

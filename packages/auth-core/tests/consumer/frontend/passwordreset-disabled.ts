import type { AppType } from "../backend/passwordreset-disabled";

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

client.signInAppsScript({});

client.signUpEmail({
  name: "User",
  email: "user@example.com",
  password: "password",
});

client.signUpAppsScript({
  name: "User",
});

client.getSession("session-id");

client.signOut("session-id");

// @ts-expect-error password reset is disabled
client.forgotPassword({
  email: "user@example.com",
});

// @ts-expect-error password reset is disabled
client.resetPassword({
  token: "token",
  newPassword: "new-password",
});

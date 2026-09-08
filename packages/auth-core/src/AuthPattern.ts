export const authPattern = {
  emailPassword: "emailPassword",
  appsScript: "appsScript",
} as const;

export type AuthPattern = (typeof authPattern)[keyof typeof authPattern];

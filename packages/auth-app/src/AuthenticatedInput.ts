export type AuthenticatedInput<TInput extends object = Record<never, never>> =
  TInput & {
    token: string;
  };

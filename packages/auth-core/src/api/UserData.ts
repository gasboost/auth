import { User } from "../domain/User";

export type UserDataProvider<TData> = (context: {
  readonly user: User;
}) => TData | Promise<TData>;
export type AuthenticatedUser<TData = never> = [TData] extends [never]
  ? User
  : User & { readonly data: TData };

export async function resolveUser<TData = never>(
  user: User,
  data?: UserDataProvider<TData>,
): Promise<AuthenticatedUser<TData>> {
  if (!data) return user as AuthenticatedUser<TData>;
  // Use a fresh domain object so response data never mutates the repository user.
  return Object.assign(new User(user), {
    data: await data({ user }),
  }) as AuthenticatedUser<TData>;
}

import type { AuthPattern } from "../AuthPattern";
import { Account } from "../domain/Account";
import type { User } from "../domain/User";

export interface AppsScriptAuthRepository {
  account: {
    findByIdentity(
      provider: AuthPattern,
      identifier: string,
    ): Promise<Account | null>;
  };

  user: {
    find: (id: string) => Promise<User | null>;
    create: (user: User) => Promise<User>;
  };
}

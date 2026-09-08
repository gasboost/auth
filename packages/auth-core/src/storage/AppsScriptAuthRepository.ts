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

export type Schema = {
  user?: {
    modelName?: string;
    fields?: {
      id?: string;
      name?: string;
    };
  };

  account?: {
    modelName?: string;
    fields?: {
      id?: string;
      userId?: string;
      provider?: string;
      providerAccountId?: string;
      password?: string;
    };
  };
};

const defaultSchema = {
  user: {
    modelName: "user",
    fields: {
      id: "id",
      name: "name",
    },
  },
  account: {
    modelName: "account",
    fields: {
      id: "id",
      userId: "userId",
      provider: "provider",
      providerAccountId: "providerAccountId",
      password: "password",
    },
  },
};

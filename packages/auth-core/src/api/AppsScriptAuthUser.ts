import { User } from "../domain/User";
import type { AppsScriptAuthRepository } from "../storage/AppsScriptAuthRepository";

/** Server-side user management. Callers authorize access and account linking. */
export class AppsScriptAuthUser {
  constructor(
    private readonly repository: AppsScriptAuthRepository,
    private readonly utilities: GoogleAppsScript.Utilities.Utilities,
  ) {}

  public async find(id: string): Promise<User | null> {
    if (!id?.trim()) throw new Error("User ID is required");
    return this.repository.user.find(id);
  }

  /** Create only a User row; accounts are added explicitly through account.add(). */
  public async create(input: { id?: string; name: string }): Promise<User> {
    const id = input.id ?? this.utilities.getUuid();
    if (!id.trim()) throw new Error("User ID is required");
    if (await this.repository.user.find(id))
      throw new Error("User already registered");
    return this.repository.user.create(
      new User({ id, name: input.name, accounts: [] }),
    );
  }
}

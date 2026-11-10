import { UserDTO } from "../dto/UserDTO";
import { SessionDTO } from "../dto/SessionDTO";
import type { AppsScriptAuthRepository } from "../storage/AppsScriptAuthRepository";
import { resolveUser, type UserDataProvider } from "./UserData";
import { SessionId } from "../domain/Session";
import { AppsScriptSessionStorage } from "../storage/AppsScriptSessionStorage";

export class AppsScriptAuthSession<TData = never> {
  private readonly repository: AppsScriptAuthRepository | undefined;
  private readonly userData: UserDataProvider<TData> | undefined;
  private sessionStorage: AppsScriptSessionStorage;
  constructor({
    sessionStorage,
    repository,
    userData,
  }: {
    sessionStorage: AppsScriptSessionStorage;
    repository?: AppsScriptAuthRepository;
    userData?: UserDataProvider<TData>;
  }) {
    this.sessionStorage = sessionStorage;
    this.repository = repository;
    this.userData = userData;
  }

  public async get(sessionId: SessionId): Promise<SessionDTO | null> {
    const session = await this.sessionStorage.get(sessionId);
    if (session && session.isExpired(new Date())) {
      await this.sessionStorage.delete(session.id);
      return null;
    }
    return session ? new SessionDTO(session) : null;
  }

  /** RPC response: retain the existing session fields and add the current user. */
  public async getWithUser(
    sessionId: SessionId,
  ): Promise<(SessionDTO & { readonly user: UserDTO<TData> }) | null> {
    const session = await this.get(sessionId);
    if (!session) return null;
    if (!this.repository) throw new Error("User repository is required");
    const user = await this.repository.user.find(session.userId);
    if (!user) return null;
    return {
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      user: new UserDTO<TData>(await resolveUser(user, this.userData)),
    };
  }

  public async cleanup() {
    await this.sessionStorage.cleanupExpired();
  }
}

import { Session, type SessionId } from "../domain/Session";
import type { AppsScriptSessionStorage } from "./AppsScriptSessionStorage";

export class AppsScriptCacheSessionStorage implements AppsScriptSessionStorage {
  constructor(private readonly storage: GoogleAppsScript.Cache.Cache) {}

  async save(session: Session): Promise<void> {
    const expirationInSeconds = Math.floor(
      (session.expiresAt.getTime() - Date.now()) / 1000,
    );

    this.storage.put(session.id, JSON.stringify(session), expirationInSeconds);
  }

  async get(id: SessionId): Promise<Session | null> {
    const value = this.storage.get(id);

    if (!value) {
      return null;
    }

    const data = JSON.parse(value) as {
      id: SessionId;
      userId: string;
      createdAt: string;
      expiresAt: string;
    };

    return new Session({
      id: data.id,
      userId: data.userId,
      createdAt: new Date(data.createdAt),
      expiresAt: new Date(data.expiresAt),
    });
  }

  async delete(id: SessionId): Promise<void> {
    this.storage.remove(id);
  }

  async cleanupExpired(): Promise<void> {
    // CacheService handles expiration automatically.
  }
}

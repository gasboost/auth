import { Session, SessionId } from "../domain/Session";
import type { AppsScriptSessionStorage } from "./AppsScriptSessionStorage";

export class AppsScriptPropertiesSessionStorage implements AppsScriptSessionStorage {
  private readonly prefix = "session:";
  constructor(
    private readonly storage: GoogleAppsScript.Properties.Properties,
  ) {}

  async save(session: Session): Promise<void> {
    this.storage.setProperty(
      `${this.prefix}${session.id}`,
      JSON.stringify(session),
    );
  }

  async get(id: SessionId): Promise<Session | null> {
    const value = this.storage.getProperty(`${this.prefix}${id}`);

    if (!value) {
      return null;
    }

    const stored = JSON.parse(value) as {
      id: SessionId;
      userId: string;
      createdAt: string;
      expiresAt: string;
    };

    const session = new Session({
      id: stored.id,
      userId: stored.userId,
      createdAt: new Date(stored.createdAt),
      expiresAt: new Date(stored.expiresAt),
    });

    if (session.expiresAt.getTime() <= Date.now()) {
      this.storage.deleteProperty(`${this.prefix}${id}`);
      return null;
    }

    return session;
  }

  async delete(id: SessionId): Promise<void> {
    this.storage.deleteProperty(`${this.prefix}${id}`);
  }

  async cleanupExpired(): Promise<void> {
    const properties = this.storage.getProperties();
    const now = new Date();

    for (const [key, value] of Object.entries(properties)) {
      if (!key.startsWith(this.prefix)) {
        continue;
      }

      const sessionData = JSON.parse(value) as {
        id: SessionId;
        userId: string;
        createdAt: string;
        expiresAt: string;
      };

      const session = new Session({
        id: sessionData.id,
        userId: sessionData.userId,
        createdAt: new Date(sessionData.createdAt),
        expiresAt: new Date(sessionData.expiresAt),
      });

      if (session.isExpired(now)) {
        this.storage.deleteProperty(key);
      }
    }
  }
}

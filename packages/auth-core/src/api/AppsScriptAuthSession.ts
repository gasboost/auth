import { SessionId } from "../domain/Session";
import { AppsScriptSessionStorage } from "../storage/AppsScriptSessionStorage";

export class AppsScriptAuthSession {
  private sessionStorage: AppsScriptSessionStorage;
  constructor({
    sessionStorage,
  }: {
    sessionStorage: AppsScriptSessionStorage;
  }) {
    this.sessionStorage = sessionStorage;
  }

  public async get(sessionId: SessionId) {
    const session = await this.sessionStorage.get(sessionId);
    if (session && session.isExpired(new Date())) {
      await this.sessionStorage.delete(session.id);
      return null;
    }
    return session;
  }

  public async cleanup() {
    await this.sessionStorage.cleanupExpired();
  }
}

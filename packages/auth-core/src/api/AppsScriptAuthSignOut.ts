import type { SessionId } from "../domain/Session";
import type { AppsScriptSessionStorage } from "../storage/AppsScriptSessionStorage";

export class AppsScriptAuthSignOut {
  constructor(private readonly sessionStorage: AppsScriptSessionStorage) {}

  public async execute(sessionId: SessionId): Promise<void> {
    await this.sessionStorage.delete(sessionId);
  }
}

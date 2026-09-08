import type { Session, SessionId } from "../domain/Session";

export interface AppsScriptSessionStorage {
  save(session: Session): Promise<void>;
  get(id: SessionId): Promise<Session | null>;
  delete(id: SessionId): Promise<void>;
  cleanupExpired(): Promise<void>;
}

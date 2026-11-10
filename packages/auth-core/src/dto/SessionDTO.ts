import type { Session } from "../domain/Session";

export class SessionDTO {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;

  constructor(
    session: Pick<Session, "id" | "userId" | "createdAt" | "expiresAt">,
  ) {
    this.id = session.id;
    this.userId = session.userId;
    this.createdAt = session.createdAt;
    this.expiresAt = session.expiresAt;
  }
}

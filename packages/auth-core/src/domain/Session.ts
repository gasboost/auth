export type SessionId = string;

export class Session {
  readonly id: SessionId;
  readonly userId: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;

  constructor({
    id,
    userId,
    createdAt,
    expiresAt,
  }: {
    id: SessionId;
    userId: string;
    createdAt: Date;
    expiresAt: Date;
  }) {
    this.id = id;
    this.userId = userId;
    this.createdAt = createdAt;
    this.expiresAt = expiresAt;
  }

  isExpired(now: Date): boolean {
    return now > this.expiresAt;
  }
}

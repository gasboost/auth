import { describe, expect, it } from "vitest";
import { Session } from "../../src/domain/Session";

describe("Session", () => {
  const expiresAt = new Date("2026-09-09T10:00:00.000Z");

  const session = new Session({
    id: "session-1",
    userId: "user-1",
    createdAt: new Date("2026-09-09T09:00:00.000Z"),
    expiresAt,
  });

  it("有効期限前は期限切れではない", () => {
    expect(session.isExpired(new Date("2026-09-09T09:59:59.999Z"))).toBe(false);
  });

  it("有効期限後は期限切れになる", () => {
    expect(session.isExpired(new Date("2026-09-09T10:00:00.001Z"))).toBe(true);
  });

  it("有効期限と同時刻では期限切れではない", () => {
    expect(session.isExpired(expiresAt)).toBe(false);
  });
});

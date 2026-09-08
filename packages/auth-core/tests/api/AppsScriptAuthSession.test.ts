import { describe, expect, it, vi } from "vitest";

import { AppsScriptAuthSession } from "../../src/api/AppsScriptAuthSession";
import { Session } from "../../src/domain/Session";
import type { AppsScriptSessionStorage } from "../../src/storage/AppsScriptSessionStorage";

function createSessionStorage() {
  return {
    save: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    cleanupExpired: vi.fn(),
  } satisfies AppsScriptSessionStorage;
}

describe("AppsScriptAuthSession", () => {
  it("Sessionを取得できる", async () => {
    const sessionStorage = createSessionStorage();

    const session = new Session({
      id: "session-1",
      userId: "user-1",
      createdAt: new Date("2026-09-09T00:00:00.000Z"),
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });

    vi.mocked(sessionStorage.get).mockResolvedValue(session);

    const api = new AppsScriptAuthSession({
      sessionStorage,
    });

    await expect(api.get("session-1")).resolves.toBe(session);

    expect(sessionStorage.get).toHaveBeenCalledWith("session-1");
  });

  it("Sessionが存在しない場合はnullを返す", async () => {
    const sessionStorage = createSessionStorage();

    vi.mocked(sessionStorage.get).mockResolvedValue(null);

    const api = new AppsScriptAuthSession({
      sessionStorage,
    });

    await expect(api.get("session-1")).resolves.toBeNull();
  });

  it("期限切れSessionは削除してnullを返す", async () => {
    const sessionStorage = createSessionStorage();

    const session = new Session({
      id: "session-1",
      userId: "user-1",
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
      expiresAt: new Date("2020-01-02T00:00:00.000Z"),
    });

    vi.mocked(sessionStorage.get).mockResolvedValue(session);

    const api = new AppsScriptAuthSession({
      sessionStorage,
    });

    await expect(api.get("session-1")).resolves.toBeNull();

    expect(sessionStorage.delete).toHaveBeenCalledWith("session-1");
  });

  it("cleanupはSessionStorageに委譲する", async () => {
    const sessionStorage = createSessionStorage();

    const api = new AppsScriptAuthSession({
      sessionStorage,
    });

    await api.cleanup();

    expect(sessionStorage.cleanupExpired).toHaveBeenCalledOnce();
  });
});

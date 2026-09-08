import { InMemoryCacheService } from "@gasboost/fake-core";
import { describe, expect, it } from "vitest";

import { Session } from "../../src/domain/Session";
import { AppsScriptCacheSessionStorage } from "../../src/storage/AppsScriptCacheSessionStorage";

describe("AppsScriptCacheSessionStorage", () => {
  it("Sessionを保存して取得できる", async () => {
    const cacheService = new InMemoryCacheService();
    const storage = new AppsScriptCacheSessionStorage(
      cacheService.getScriptCache(),
    );

    const session = new Session({
      id: "session-1",
      userId: "user-1",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await storage.save(session);

    const restored = await storage.get("session-1");

    expect(restored).toEqual(session);
    expect(restored).toBeInstanceOf(Session);
  });

  it("存在しないSessionはnullを返す", async () => {
    const cacheService = new InMemoryCacheService();
    const storage = new AppsScriptCacheSessionStorage(
      cacheService.getScriptCache(),
    );

    await expect(storage.get("missing-session")).resolves.toBeNull();
  });

  it("保存したSessionを削除できる", async () => {
    const cacheService = new InMemoryCacheService();
    const storage = new AppsScriptCacheSessionStorage(
      cacheService.getScriptCache(),
    );

    const session = new Session({
      id: "session-1",
      userId: "user-1",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await storage.save(session);

    expect(await storage.get("session-1")).not.toBeNull();

    await storage.delete("session-1");

    expect(await storage.get("session-1")).toBeNull();
  });

  it("cleanupExpiredはCacheServiceのexpirationに委譲する", async () => {
    const cacheService = new InMemoryCacheService();
    const storage = new AppsScriptCacheSessionStorage(
      cacheService.getScriptCache(),
    );

    await expect(storage.cleanupExpired()).resolves.toBeUndefined();
  });
});

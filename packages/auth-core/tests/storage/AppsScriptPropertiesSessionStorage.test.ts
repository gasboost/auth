import { InMemoryPropertiesService } from "@gasboost/fake-core";
import { describe, expect, it } from "vitest";

import { Session } from "../../src/domain/Session";
import { AppsScriptPropertiesSessionStorage } from "../../src/storage/AppsScriptPropertiesSessionStorage";

describe("AppsScriptPropertiesSessionStorage", () => {
  it("Sessionを保存して取得できる", async () => {
    const propertiesService = new InMemoryPropertiesService();
    const storage = new AppsScriptPropertiesSessionStorage(
      propertiesService.getScriptProperties(),
    );

    const session = new Session({
      id: "session-1",
      userId: "user-1",
      createdAt: new Date("2026-09-09T00:00:00.000Z"),
      expiresAt: new Date("2099-09-09T00:00:00.000Z"),
    });

    await storage.save(session);

    const restored = await storage.get("session-1");

    expect(restored).toEqual(session);
    expect(restored).toBeInstanceOf(Session);
  });

  it("存在しないSessionはnullを返す", async () => {
    const propertiesService = new InMemoryPropertiesService();
    const storage = new AppsScriptPropertiesSessionStorage(
      propertiesService.getScriptProperties(),
    );

    await expect(storage.get("missing-session")).resolves.toBeNull();
  });

  it("保存したSessionを削除できる", async () => {
    const propertiesService = new InMemoryPropertiesService();
    const storage = new AppsScriptPropertiesSessionStorage(
      propertiesService.getScriptProperties(),
    );

    const session = new Session({
      id: "session-1",
      userId: "user-1",
      createdAt: new Date("2026-09-09T00:00:00.000Z"),
      expiresAt: new Date("2099-09-09T00:00:00.000Z"),
    });

    await storage.save(session);

    expect(await storage.get("session-1")).not.toBeNull();

    await storage.delete("session-1");

    expect(await storage.get("session-1")).toBeNull();
  });

  it("期限切れSessionを取得した場合は削除してnullを返す", async () => {
    const propertiesService = new InMemoryPropertiesService();
    const properties = propertiesService.getScriptProperties();

    const storage = new AppsScriptPropertiesSessionStorage(properties);

    const expiredSession = new Session({
      id: "session-1",
      userId: "user-1",
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
      expiresAt: new Date("2020-01-02T00:00:00.000Z"),
    });

    await storage.save(expiredSession);

    await expect(storage.get("session-1")).resolves.toBeNull();

    expect(properties.getProperty("session:session-1")).toBeNull();
  });

  it("cleanupExpiredは期限切れSessionだけ削除する", async () => {
    const propertiesService = new InMemoryPropertiesService();
    const properties = propertiesService.getScriptProperties();

    const storage = new AppsScriptPropertiesSessionStorage(properties);

    const expiredSession = new Session({
      id: "expired-session",
      userId: "user-1",
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
      expiresAt: new Date("2020-01-02T00:00:00.000Z"),
    });

    const activeSession = new Session({
      id: "active-session",
      userId: "user-2",
      createdAt: new Date(),
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });

    await storage.save(expiredSession);
    await storage.save(activeSession);

    await storage.cleanupExpired();

    expect(properties.getProperty("session:expired-session")).toBeNull();

    expect(properties.getProperty("session:active-session")).not.toBeNull();
  });

  it("cleanupExpiredはSession以外のPropertyを削除しない", async () => {
    const propertiesService = new InMemoryPropertiesService();
    const properties = propertiesService.getScriptProperties();

    const storage = new AppsScriptPropertiesSessionStorage(properties);

    properties.setProperty("API_KEY", "secret-value");

    const expiredSession = new Session({
      id: "expired-session",
      userId: "user-1",
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
      expiresAt: new Date("2020-01-02T00:00:00.000Z"),
    });

    await storage.save(expiredSession);

    await storage.cleanupExpired();

    expect(properties.getProperty("API_KEY")).toBe("secret-value");

    expect(properties.getProperty("session:expired-session")).toBeNull();
  });

  it("Sessionはsession: prefix付きで保存される", async () => {
    const propertiesService = new InMemoryPropertiesService();
    const properties = propertiesService.getScriptProperties();

    const storage = new AppsScriptPropertiesSessionStorage(properties);

    const session = new Session({
      id: "session-1",
      userId: "user-1",
      createdAt: new Date(),
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });

    await storage.save(session);

    expect(properties.getProperty("session:session-1")).not.toBeNull();

    expect(properties.getProperty("session-1")).toBeNull();
  });
});

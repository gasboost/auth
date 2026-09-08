import { describe, expect, it, vi } from "vitest";

import { AppsScriptAuthSignOut } from "../../src/api/AppsScriptAuthSignOut";
import type { AppsScriptSessionStorage } from "../../src/storage/AppsScriptSessionStorage";

function createSessionStorage() {
  return {
    save: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    cleanupExpired: vi.fn(),
  } satisfies AppsScriptSessionStorage;
}

describe("AppsScriptAuthSignOut", () => {
  it("Sessionを削除する", async () => {
    const sessionStorage = createSessionStorage();

    const signOut = new AppsScriptAuthSignOut(sessionStorage);

    await signOut.execute("session-1");

    expect(sessionStorage.delete).toHaveBeenCalledWith("session-1");
  });

  it("SessionStorageの削除エラーをそのまま返す", async () => {
    const sessionStorage = createSessionStorage();

    vi.mocked(sessionStorage.delete).mockRejectedValue(
      new Error("delete failed"),
    );

    const signOut = new AppsScriptAuthSignOut(sessionStorage);

    await expect(signOut.execute("session-1")).rejects.toThrow("delete failed");
  });
});

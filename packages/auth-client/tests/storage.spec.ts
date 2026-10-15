import { afterEach, describe, expect, it, vi } from "vitest";

import {
  localStorageAuthStorage,
  memoryAuthStorage,
  sessionStorageAuthStorage,
  type BrowserTokenStorage,
} from "../src";

function browserStorage(): BrowserTokenStorage {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key) => {
      values.delete(key);
    }),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("AuthStorage factories", () => {
  it("memory storage instances have independent tokens", () => {
    const first = memoryAuthStorage();
    const second = memoryAuthStorage();
    expect(first).not.toBe(second);
    expect(first.get()).toBeNull();
    first.set("session-1");
    expect(first.get()).toBe("session-1");
    expect(second.get()).toBeNull();
    first.remove();
    expect(first.get()).toBeNull();
  });

  it.each([localStorageAuthStorage, sessionStorageAuthStorage])(
    "%s supports persistence, custom keys, and independent wrappers",
    (factory) => {
      const backing = browserStorage();
      const first = factory({ storage: backing, key: "first" });
      const second = factory({ storage: backing, key: "second" });
      expect(first).not.toBe(second);
      first.set("token-1");
      second.set("token-2");
      expect(first.get()).toBe("token-1");
      expect(second.get()).toBe("token-2");
      expect(factory({ storage: backing, key: "first" }).get()).toBe("token-1");
      first.remove();
      expect(first.get()).toBeNull();
      expect(second.get()).toBe("token-2");
    },
  );

  it("uses the correct browser globals with a stable default key", () => {
    const local = browserStorage();
    const session = browserStorage();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);
    localStorageAuthStorage().set("local-token");
    sessionStorageAuthStorage().set("session-token");
    expect(local.getItem("@gasboost/auth")).toBe("local-token");
    expect(session.getItem("@gasboost/auth")).toBe("session-token");
  });

  it.each([
    ["localStorage", localStorageAuthStorage],
    ["sessionStorage", sessionStorageAuthStorage],
  ] as const)(
    "reports unavailable %s without silently changing persistence",
    (name, factory) => {
      vi.stubGlobal(name, undefined);
      expect(() => factory()).toThrow(`${name} is not available`);
    },
  );

  it("propagates browser storage errors", () => {
    const backing = browserStorage();
    const error = new Error("Quota exceeded");
    vi.mocked(backing.setItem).mockImplementation(() => {
      throw error;
    });
    expect(() =>
      localStorageAuthStorage({ storage: backing }).set("token"),
    ).toThrow(error);
  });
});

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  authClient,
  authCore,
  memoryAuthStorage,
  type AuthRemote,
  type AuthStorage,
  type AuthSession,
} from "../src";

type Session = AuthSession<{ id: string }>;
const first: Session = { token: "session-1", user: { id: "user-1" } };
const second: Session = { token: "session-2", user: { id: "user-2" } };

function setup(storage: AuthStorage = memoryAuthStorage()) {
  const remote = {
    signIn: vi.fn(async (_input: { email: string }) => first),
    signUp: vi.fn(async (_input: { name: string }) => second),
    signOut: vi.fn(async (_token: string) => {}),
    getSession: vi.fn(async (_token: string): Promise<Session | null> => first),
  } satisfies AuthRemote<Session, { email: string }, { name: string }>;
  const auth = authClient({ remote, storage });
  return { auth, remote, storage };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("authCore", () => {
  it("starts unauthenticated until a session has been validated", () => {
    const storage = memoryAuthStorage();
    storage.set("saved");
    const core = authCore<Session>({ storage });
    expect(core.getState()).toEqual({
      session: null,
      user: null,
      token: null,
      isAuthenticated: false,
    });
    const listener = vi.fn();
    const unsubscribe = core.subscribe(listener);
    const initial = core.getState();
    core.setSession(first);
    expect(storage.get()).toBe(first.token);
    expect(core.getState()).not.toBe(initial);
    expect(core.getUser()).toEqual(first.user);
    expect(listener).toHaveBeenCalledWith(core.getState());
    unsubscribe();
    core.setSession(null);
    expect(storage.get()).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
  });

  it("continues notifying subscribers when one throws", () => {
    const core = authCore({ storage: memoryAuthStorage() });
    core.subscribe(() => {
      throw new Error("UI failed");
    });
    const listener = vi.fn();
    core.subscribe(listener);
    expect(() => core.setSession(first)).not.toThrow();
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("authClient", () => {
  it("signs in and signs up using the injected remote and storage", async () => {
    const { auth, storage, remote } = setup();
    const listener = vi.fn();
    auth.subscribe(listener);
    expect(await auth.signIn({ email: "user@example.com" })).toBe(first);
    expect(remote.signIn).toHaveBeenCalledWith({ email: "user@example.com" });
    expect(auth.getSession()).toBe(first);
    expect(auth.getUser()).toEqual(first.user);
    expect(auth.getToken()).toBe(storage.get());
    expect(auth.getState().isAuthenticated).toBe(true);
    expect(await auth.signUp({ name: "Taro" })).toBe(second);
    expect(storage.get()).toBe(second.token);
    expect(listener).toHaveBeenCalledTimes(2);
    expectTypeOf(auth.signIn).parameter(0).toEqualTypeOf<{ email: string }>();
    expectTypeOf(auth.signUp).parameter(0).toEqualTypeOf<{ name: string }>();
  });

  it("restores with a persisted token through the remote", async () => {
    const { auth, storage, remote } = setup();
    storage.set("session-1");
    expect(await auth.restoreSession()).toBe(first);
    expect(remote.getSession).toHaveBeenCalledWith("session-1");
    expect(auth.getSession()).toBe(first);
  });

  it("removes invalid saved tokens and publishes an unauthenticated state", async () => {
    const { auth, storage, remote } = setup();
    await auth.signIn({ email: "user@example.com" });
    remote.getSession.mockResolvedValue(null);
    expect(await auth.restoreSession()).toBeNull();
    expect(storage.get()).toBeNull();
    expect(auth.getSession()).toBeNull();
    expect(auth.getState().isAuthenticated).toBe(false);
  });

  it.each([null, "", " \t"])(
    "skips validation for missing/blank tokens: %j",
    async (token) => {
      const { auth, storage, remote } = setup();
      if (token !== null) storage.set(token);
      expect(await auth.restoreSession()).toBeNull();
      expect(storage.get()).toBeNull();
      expect(remote.getSession).not.toHaveBeenCalled();
    },
  );

  it("revokes the saved server session before clearing local state", async () => {
    const { auth, storage, remote } = setup();
    storage.set("session-1");
    const pending = deferred<void>();
    remote.signOut.mockReturnValue(pending.promise);
    const result = auth.signOut();
    expect(remote.signOut).toHaveBeenCalledWith("session-1");
    expect(storage.get()).toBe("session-1");
    pending.resolve();
    await result;
    expect(storage.get()).toBeNull();
    expect(auth.getState().isAuthenticated).toBe(false);
  });

  it.each([null, "", " \t"])(
    "signOut with token %j clears local state without a remote call",
    async (token) => {
      const { auth, remote, storage } = setup();
      if (token !== null) storage.set(token);
      await auth.signOut();
      expect(remote.signOut).not.toHaveBeenCalled();
    },
  );

  it.each(["signIn", "signUp", "getSession", "signOut"] as const)(
    "a %s failure propagates without clearing a valid session",
    async (operation) => {
      const { auth, remote, storage } = setup();
      await auth.signIn({ email: "first" });
      const error = new Error("Network unavailable");
      remote[operation].mockRejectedValue(error);
      const result =
        operation === "signIn"
          ? auth.signIn({ email: "second" })
          : operation === "signUp"
            ? auth.signUp({ name: "second" })
            : operation === "getSession"
              ? auth.restoreSession()
              : auth.signOut();
      await expect(result).rejects.toBe(error);
      expect(storage.get()).toBe(first.token);
      expect(auth.getSession()).toBe(first);
    },
  );

  it.each(["", " \n"])(
    "rejects an empty token returned by a remote: %j",
    async (token) => {
      const { auth, remote, storage } = setup();
      remote.signIn.mockResolvedValue({ ...first, token });
      await expect(auth.signIn({ email: "user" })).rejects.toThrow(
        "non-empty session token",
      );
      expect(storage.get()).toBeNull();
      expect(auth.getSession()).toBeNull();
    },
  );

  it("does not publish state if persistence fails", async () => {
    const error = new Error("Storage unavailable");
    const storage: AuthStorage = {
      get: () => null,
      set: () => {
        throw error;
      },
      remove: vi.fn(),
    };
    const { auth } = setup(storage);
    const listener = vi.fn();
    auth.subscribe(listener);
    await expect(auth.signIn({ email: "user" })).rejects.toBe(error);
    expect(auth.getSession()).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });

  it("a delayed restore cannot overwrite a newer sign in", async () => {
    const { auth, storage, remote } = setup();
    storage.set(first.token);
    const pending = deferred<Session | null>();
    remote.getSession.mockReturnValue(pending.promise);
    const restore = auth.restoreSession();
    remote.signIn.mockResolvedValue(second);
    await auth.signIn({ email: "second" });
    pending.resolve(null);
    await restore;
    expect(auth.getSession()).toBe(second);
    expect(storage.get()).toBe(second.token);
  });

  it("a delayed sign in cannot restore authentication after sign out", async () => {
    const { auth, storage, remote } = setup();
    const pending = deferred<Session>();
    remote.signIn.mockReturnValue(pending.promise);
    const signIn = auth.signIn({ email: "user" });
    await auth.signOut();
    pending.resolve(first);
    await signIn;
    expect(auth.getSession()).toBeNull();
    expect(storage.get()).toBeNull();
  });

  it("a delayed sign out cannot clear a newer sign in", async () => {
    const { auth, storage, remote } = setup();
    await auth.signIn({ email: "first" });
    const pending = deferred<void>();
    remote.signOut.mockReturnValue(pending.promise);
    const signOut = auth.signOut();
    remote.signIn.mockResolvedValue(second);
    await auth.signIn({ email: "second" });
    pending.resolve();
    await signOut;
    expect(auth.getSession()).toBe(second);
    expect(storage.get()).toBe(second.token);
  });

  it("does not remove tokens replaced by another storage owner during restore", async () => {
    const { auth, storage, remote } = setup();
    storage.set(first.token);
    const pending = deferred<Session | null>();
    remote.getSession.mockReturnValue(pending.promise);
    const result = auth.restoreSession();
    storage.set(second.token);
    pending.resolve(null);
    await result;
    expect(storage.get()).toBe(second.token);
  });
});

describe("authClient hook failure and concurrency", () => {
  it.each(["signIn", "signUp"] as const)(
    "revokes a failed %s session without retrying or replacing previous state",
    async (method) => {
      const { remote, storage } = setup();
      const error = new Error("Consumer hook failed");
      const afterSignIn = vi.fn();
      const auth = authClient({ remote, storage, hooks: { afterSignIn } });
      await auth.signIn({ email: "first" });
      remote.signIn.mockResolvedValue(second);
      afterSignIn.mockRejectedValue(error);
      remote.signOut.mockRejectedValue(new Error("Revocation failed"));
      const result =
        method === "signIn"
          ? auth.signIn({ email: "next" })
          : auth.signUp({ name: "next" });
      await expect(result).rejects.toBe(error);
      expect(remote.signOut).toHaveBeenCalledExactlyOnceWith(second.token);
      expect(remote[method]).toHaveBeenCalledTimes(method === "signIn" ? 2 : 1);
      expect(auth.getSession()).toBe(first);
      expect(storage.get()).toBe(first.token);
    },
  );

  it.each(["signOut", "signIn", "restoreSession"] as const)(
    "a delayed consumer hook cannot overwrite a newer %s",
    async (method) => {
      const { remote, storage } = setup();
      const pending = deferred<void>();
      const entered = deferred<void>();
      const afterSignIn = vi.fn(async () => {
        entered.resolve();
        await pending.promise;
      });
      const auth = authClient({ remote, storage, hooks: { afterSignIn } });
      const signup = auth.signUp({ name: "old" });
      await entered.promise;
      afterSignIn.mockResolvedValue(undefined);
      if (method === "signOut") await auth.signOut();
      else if (method === "signIn") await auth.signIn({ email: "new" });
      else {
        storage.set(first.token);
        await auth.restoreSession();
      }
      pending.resolve();
      await signup;
      expect(auth.getSession()).toBe(method === "signOut" ? null : first);
      expect(storage.get()).toBe(method === "signOut" ? null : first.token);
    },
  );

  it("a stale RPC result skips the consumer hook", async () => {
    const { remote, storage } = setup();
    const pending = deferred<Session>();
    remote.signUp.mockReturnValue(pending.promise);
    const afterSignIn = vi.fn();
    const auth = authClient({ remote, storage, hooks: { afterSignIn } });
    const signup = auth.signUp({ name: "old" });
    await auth.signIn({ email: "new" });
    pending.resolve(second);
    expect(await signup).toBe(second);
    expect(afterSignIn).toHaveBeenCalledExactlyOnceWith(first);
    expect(auth.getSession()).toBe(first);
  });

  it("a stale failing hook revokes only its own session and preserves newer state", async () => {
    const { remote, storage } = setup();
    const pending = deferred<void>();
    const entered = deferred<void>();
    const afterSignIn = vi.fn(async () => {
      entered.resolve();
      await pending.promise;
    });
    const auth = authClient({ remote, storage, hooks: { afterSignIn } });
    const signup = auth.signUp({ name: "old" });
    await entered.promise;
    afterSignIn.mockResolvedValue(undefined);
    await auth.signIn({ email: "new" });
    const error = new Error("Old hook failed");
    pending.reject(error);
    await expect(signup).rejects.toBe(error);
    expect(remote.signOut).toHaveBeenCalledExactlyOnceWith(second.token);
    expect(auth.getSession()).toBe(first);
    expect(storage.get()).toBe(first.token);
  });
});

describe("authClient external synchronization", () => {
  it("restores GAS before awaiting external synchronization without revoking on mismatch", async () => {
    const { remote, storage } = setup();
    storage.set(first.token);
    const pending = deferred<boolean>();
    const entered = deferred<void>();
    const sync = vi.fn((session: Session | null) => {
      expect(session).toBe(first);
      expect(auth.getSession()).toBe(first);
      entered.resolve();
      return pending.promise;
    });
    const afterSignIn = vi.fn();
    const afterSignOut = vi.fn();
    const auth = authClient({
      remote,
      storage,
      hooks: { sync, afterSignIn, afterSignOut },
    });
    const result = auth.sync();
    await entered.promise;
    pending.resolve(false);
    await expect(result).resolves.toEqual({
      session: first,
      synchronized: false,
    });
    expect(sync).toHaveBeenCalledExactlyOnceWith(first);
    expect(auth.getState().isAuthenticated).toBe(true);
    expect(storage.get()).toBe(first.token);
    expect(remote.signOut).not.toHaveBeenCalled();
    expect(afterSignIn).not.toHaveBeenCalled();
    expect(afterSignOut).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "returns the external hook result %s",
    async (synchronized) => {
      const { remote, storage } = setup();
      storage.set(first.token);
      const auth = authClient({
        remote,
        storage,
        hooks: { sync: () => synchronized },
      });
      await expect(auth.sync()).resolves.toEqual({
        session: first,
        synchronized,
      });
    },
  );

  it.each([null, "", " \t", "expired"])(
    "passes null to the hook for token %j without external sign out",
    async (token) => {
      const { remote, storage } = setup();
      remote.getSession.mockResolvedValue(null);
      if (token !== null) storage.set(token);
      const sync = vi.fn(() => false);
      const afterSignOut = vi.fn();
      const auth = authClient({
        remote,
        storage,
        hooks: { sync, afterSignOut },
      });
      await expect(auth.sync()).resolves.toEqual({
        session: null,
        synchronized: false,
      });
      expect(sync).toHaveBeenCalledExactlyOnceWith(null);
      expect(storage.get()).toBeNull();
      expect(remote.signOut).not.toHaveBeenCalled();
      expect(afterSignOut).not.toHaveBeenCalled();
      expect(remote.getSession).toHaveBeenCalledTimes(
        token === "expired" ? 1 : 0,
      );
    },
  );

  it.each([true, false])(
    "synchronizes without a hook when a saved token exists: %s",
    async (saved) => {
      const { auth, storage } = setup();
      if (saved) storage.set(first.token);
      await expect(auth.sync()).resolves.toEqual({
        session: saved ? first : null,
        synchronized: true,
      });
    },
  );

  it("keeps restoreSession limited to GAS", async () => {
    const { remote, storage } = setup();
    const sync = vi.fn(() => true);
    const afterSignOut = vi.fn();
    const auth = authClient({ remote, storage, hooks: { sync, afterSignOut } });
    storage.set(first.token);
    await auth.restoreSession();
    remote.getSession.mockResolvedValue(null);
    await auth.restoreSession();
    expect(sync).not.toHaveBeenCalled();
    expect(afterSignOut).not.toHaveBeenCalled();
  });

  it.each(["remote", "hook"])(
    "propagates a %s error and preserves the GAS session",
    async (source) => {
      const { remote, storage } = setup();
      const error = new Error("Sync failed");
      const sync = vi.fn(() => true);
      const afterSignOut = vi.fn();
      const auth = authClient({
        remote,
        storage,
        hooks: { sync, afterSignOut },
      });
      await auth.signIn({ email: "first" });
      if (source === "remote") remote.getSession.mockRejectedValue(error);
      else
        sync.mockImplementation(() => {
          throw error;
        });
      await expect(auth.sync()).rejects.toBe(error);
      expect(auth.getSession()).toBe(first);
      expect(storage.get()).toBe(first.token);
      expect(remote.signOut).not.toHaveBeenCalled();
      expect(afterSignOut).not.toHaveBeenCalled();
      expect(sync).toHaveBeenCalledTimes(source === "hook" ? 1 : 0);
    },
  );

  it.each(["signIn", "signUp", "signOut", "restoreSession", "sync"] as const)(
    "a delayed sync restoration skips its hook after a newer %s",
    async (method) => {
      const { remote, storage } = setup();
      storage.set(first.token);
      const pending = deferred<Session | null>();
      remote.getSession
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValue(second);
      remote.signIn.mockResolvedValue(second);
      const sync = vi.fn(() => true);
      const auth = authClient({ remote, storage, hooks: { sync } });
      const stale = auth.sync();
      if (method === "signIn") await auth.signIn({ email: "next" });
      else if (method === "signUp") await auth.signUp({ name: "next" });
      else await auth[method]();
      pending.resolve(first);
      await expect(stale).resolves.toEqual({
        session: first,
        synchronized: false,
      });
      expect(auth.getSession()).toBe(method === "signOut" ? null : second);
      expect(storage.get()).toBe(method === "signOut" ? null : second.token);
      expect(sync).toHaveBeenCalledTimes(method === "sync" ? 1 : 0);
    },
  );

  it.each(["signIn", "signUp", "signOut", "restoreSession", "sync"] as const)(
    "a delayed sync hook cannot overwrite a newer %s or report success",
    async (method) => {
      const { remote, storage } = setup();
      storage.set(first.token);
      const pending = deferred<boolean>();
      const entered = deferred<void>();
      const sync = vi.fn(() => {
        entered.resolve();
        return pending.promise;
      });
      const auth = authClient({ remote, storage, hooks: { sync } });
      const stale = auth.sync();
      await entered.promise;
      remote.signIn.mockResolvedValue(second);
      remote.getSession.mockResolvedValue(second);
      sync.mockResolvedValue(true);
      if (method === "signIn") await auth.signIn({ email: "next" });
      else if (method === "signUp") await auth.signUp({ name: "next" });
      else await auth[method]();
      pending.resolve(true);
      await expect(stale).resolves.toEqual({
        session: first,
        synchronized: false,
      });
      expect(auth.getSession()).toBe(method === "signOut" ? null : second);
      expect(storage.get()).toBe(method === "signOut" ? null : second.token);
    },
  );

  it("propagates a stale hook rejection while keeping a newer session", async () => {
    const { remote, storage } = setup();
    storage.set(first.token);
    const pending = deferred<boolean>();
    const entered = deferred<void>();
    const auth = authClient({
      remote,
      storage,
      hooks: {
        sync: () => {
          entered.resolve();
          return pending.promise;
        },
      },
    });
    const stale = auth.sync();
    await entered.promise;
    await auth.signUp({ name: "next" });
    const error = new Error("Old sync failed");
    pending.reject(error);
    await expect(stale).rejects.toBe(error);
    expect(auth.getSession()).toBe(second);
    expect(storage.get()).toBe(second.token);
    expect(remote.signOut).not.toHaveBeenCalled();
  });

  it("skips external synchronization when another storage owner replaces the token", async () => {
    const { remote, storage } = setup();
    storage.set(first.token);
    const pending = deferred<Session | null>();
    remote.getSession.mockReturnValue(pending.promise);
    const sync = vi.fn(() => true);
    const auth = authClient({ remote, storage, hooks: { sync } });
    const stale = auth.sync();
    storage.set(second.token);
    pending.resolve(first);
    await expect(stale).resolves.toEqual({
      session: first,
      synchronized: false,
    });
    expect(storage.get()).toBe(second.token);
    expect(sync).not.toHaveBeenCalled();
  });
});

describe("authClient external sign out", () => {
  it.each([null, "", " \t", first.token])(
    "awaits external sign out after clearing GAS for token %j",
    async (token) => {
      const { remote, storage } = setup();
      if (token !== null) storage.set(token);
      const pending = deferred<void>();
      const entered = deferred<void>();
      const afterSignOut = vi.fn(() => {
        expect(storage.get()).toBeNull();
        expect(auth.getState().isAuthenticated).toBe(false);
        entered.resolve();
        return pending.promise;
      });
      const auth = authClient({ remote, storage, hooks: { afterSignOut } });
      let completed = false;
      const result = auth.signOut().then(() => {
        completed = true;
      });
      await entered.promise;
      expect(completed).toBe(false);
      pending.resolve();
      await result;
      expect(afterSignOut).toHaveBeenCalledExactlyOnceWith();
      expect(remote.signOut).toHaveBeenCalledTimes(
        token === first.token ? 1 : 0,
      );
    },
  );

  it("does not run external sign out when GAS revocation fails", async () => {
    const { remote, storage } = setup();
    const afterSignOut = vi.fn();
    const auth = authClient({ remote, storage, hooks: { afterSignOut } });
    await auth.signIn({ email: "first" });
    const error = new Error("GAS sign out failed");
    remote.signOut.mockRejectedValue(error);
    await expect(auth.signOut()).rejects.toBe(error);
    expect(afterSignOut).not.toHaveBeenCalled();
    expect(auth.getSession()).toBe(first);
    expect(storage.get()).toBe(first.token);
  });

  it("propagates external sign out errors without rolling back GAS sign out", async () => {
    const { remote, storage } = setup();
    const error = new Error("External sign out failed");
    const auth = authClient({
      remote,
      storage,
      hooks: {
        afterSignOut: () => {
          throw error;
        },
      },
    });
    await auth.signIn({ email: "first" });
    await expect(auth.signOut()).rejects.toBe(error);
    expect(remote.signOut).toHaveBeenCalledExactlyOnceWith(first.token);
    expect(auth.getState().isAuthenticated).toBe(false);
    expect(storage.get()).toBeNull();
  });

  it("skips stale external sign out after a newer sign in", async () => {
    const { remote, storage } = setup();
    const pending = deferred<void>();
    remote.signOut.mockReturnValue(pending.promise);
    const afterSignOut = vi.fn();
    const auth = authClient({ remote, storage, hooks: { afterSignOut } });
    await auth.signIn({ email: "first" });
    const stale = auth.signOut();
    await auth.signUp({ name: "next" });
    pending.resolve();
    await stale;
    expect(afterSignOut).not.toHaveBeenCalled();
    expect(auth.getSession()).toBe(second);
  });
});

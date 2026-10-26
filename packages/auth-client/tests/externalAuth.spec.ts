import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  authClient,
  memoryAuthStorage,
  type AuthSession,
  type ExternalAuth,
} from "../src";

type Session = AuthSession<{ id: string }>;
const first: Session = { token: "session-1", user: { id: "A" } };
const second: Session = { token: "session-2", user: { id: "B" } };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
function setup(gas: Session | null = first, externalId: string | null = null) {
  const storage = memoryAuthStorage();
  if (gas) storage.set(gas.token);
  const remote = {
    signIn: vi.fn(async (_: { email: string }) => second),
    signUp: vi.fn(async (_: { name: string }) => second),
    getSession: vi.fn(async (_: string): Promise<Session | null> => gas),
    signOut: vi.fn(async (_: string) => {}),
  };
  const externalAuth = {
    getUserId: vi.fn(async (): Promise<string | null> => externalId),
    signIn: vi.fn(async (id: string) => {
      externalId = id;
    }),
    signOut: vi.fn(async () => {
      externalId = null;
    }),
  } satisfies ExternalAuth;
  const getUserId = (session: Session) => session.user!.id;
  const hooks = { afterSignIn: vi.fn(), afterSignOut: vi.fn() };
  const auth = authClient({ remote, storage, externalAuth, getUserId, hooks });
  return { auth, remote, storage, externalAuth, getUserId, hooks };
}

describe("external auth synchronization", () => {
  it.each([
    { gas: null, external: null, signIn: 0, signOut: 0 },
    { gas: null, external: "A", signIn: 0, signOut: 1 },
    { gas: first, external: null, signIn: 1, signOut: 0 },
    { gas: first, external: "A", signIn: 0, signOut: 0 },
    { gas: first, external: "B", signIn: 1, signOut: 0 },
  ])(
    "repairs GAS=$gas / external=$external",
    async ({ gas, external, signIn, signOut }) => {
      const { auth, externalAuth, remote, storage, hooks } = setup(
        gas,
        external,
      );
      externalAuth.getUserId.mockImplementation(async () => {
        expect(auth.getSession()).toBe(gas); // GAS restoration precedes SDK access.
        if (externalAuth.signIn.mock.calls.length) return "A";
        if (externalAuth.signOut.mock.calls.length) return null;
        return external;
      });
      await expect(auth.sync()).resolves.toEqual({
        session: gas,
        synchronized: true,
      });
      expect(externalAuth.signIn).toHaveBeenCalledTimes(signIn);
      if (signIn) expect(externalAuth.signIn).toHaveBeenCalledWith("A");
      expect(externalAuth.signOut).toHaveBeenCalledTimes(signOut);
      expect(externalAuth.getUserId).toHaveBeenCalledTimes(
        signIn + signOut ? 2 : 1,
      );
      expect(remote.signOut).not.toHaveBeenCalled();
      expect(hooks.afterSignIn).not.toHaveBeenCalled();
      expect(hooks.afterSignOut).not.toHaveBeenCalled();
      expect(auth.getState().isAuthenticated).toBe(gas !== null);
      expect(storage.get()).toBe(gas?.token ?? null);
    },
  );

  it.each([null, "B"])(
    "returns false when signIn fails to establish A (actual %j)",
    async (actual) => {
      const { auth, externalAuth, storage } = setup(first, actual);
      externalAuth.signIn.mockResolvedValue(undefined);
      await expect(auth.sync()).resolves.toEqual({
        session: first,
        synchronized: false,
      });
      expect(externalAuth.getUserId).toHaveBeenCalledTimes(2);
      expect(auth.getState().isAuthenticated).toBe(true);
      expect(storage.get()).toBe(first.token);
    },
  );

  it("returns false when external signOut leaves a user authenticated", async () => {
    const { auth, externalAuth } = setup(null, "B");
    externalAuth.signOut.mockResolvedValue(undefined);
    await expect(auth.sync()).resolves.toEqual({
      session: null,
      synchronized: false,
    });
  });

  it.each(["getSession", "getUserId", "signIn", "verification"])(
    "propagates %s failure without revoking valid GAS auth",
    async (stage) => {
      const { auth, externalAuth, remote, storage } = setup();
      await auth.restoreSession();
      const error = new Error(stage);
      if (stage === "getSession") remote.getSession.mockRejectedValue(error);
      else if (stage === "verification")
        externalAuth.getUserId
          .mockResolvedValueOnce(null)
          .mockRejectedValueOnce(error);
      else
        externalAuth[
          stage === "getUserId" ? "getUserId" : "signIn"
        ].mockRejectedValue(error);
      await expect(auth.sync()).rejects.toBe(error);
      expect(auth.getSession()).toBe(first);
      expect(storage.get()).toBe(first.token);
      expect(remote.signOut).not.toHaveBeenCalled();
      expect(externalAuth.signOut).not.toHaveBeenCalled();
      if (stage === "getSession")
        expect(externalAuth.getUserId).not.toHaveBeenCalled();
    },
  );

  it("propagates external signOut failure for an expired GAS session", async () => {
    const { auth, remote, externalAuth, storage } = setup(first, "A");
    remote.getSession.mockResolvedValue(null);
    const error = new Error("SDK signOut failed");
    externalAuth.signOut.mockRejectedValue(error);
    await expect(auth.sync()).rejects.toBe(error);
    expect(storage.get()).toBeNull();
    expect(auth.getState().isAuthenticated).toBe(false);
    expect(remote.signOut).not.toHaveBeenCalled();
  });

  it("clears expired GAS auth and signs out only the external user", async () => {
    const { auth, remote, externalAuth, storage } = setup(first, "A");
    await auth.restoreSession();
    remote.getSession.mockResolvedValue(null);
    await expect(auth.sync()).resolves.toEqual({
      session: null,
      synchronized: true,
    });
    expect(storage.get()).toBeNull();
    expect(externalAuth.signOut).toHaveBeenCalledOnce();
    expect(remote.signOut).not.toHaveBeenCalled();
  });

  it.each(["signIn", "signUp"] as const)(
    "preserves %s hook failure compensation without external sign out",
    async (method) => {
      const { auth, hooks, remote, externalAuth, storage } = setup(first, "A");
      await auth.restoreSession();
      const error = new Error("afterSignIn failed");
      hooks.afterSignIn.mockRejectedValue(error);
      const result =
        method === "signIn"
          ? auth.signIn({ email: "new" })
          : auth.signUp({ name: "new" });
      await expect(result).rejects.toBe(error);
      expect(remote.signOut).toHaveBeenCalledExactlyOnceWith(second.token);
      expect(externalAuth.signIn).not.toHaveBeenCalled();
      expect(externalAuth.signOut).not.toHaveBeenCalled();
      expect(storage.get()).toBe(first.token);
      expect(auth.getSession()).toBe(first);
    },
  );

  it("keeps restoreSession limited to GAS", async () => {
    const { auth, externalAuth, remote } = setup(first, "B");
    await auth.restoreSession();
    remote.getSession.mockResolvedValue(null);
    await auth.restoreSession();
    expect(externalAuth.getUserId).not.toHaveBeenCalled();
    expect(externalAuth.signIn).not.toHaveBeenCalled();
    expect(externalAuth.signOut).not.toHaveBeenCalled();
  });

  it.each([first, null])(
    "keeps consumers without externalAuth compatible",
    async (session) => {
      const { remote, storage } = setup(session);
      const auth = authClient({ remote, storage });
      expect(await auth.isSynced()).toBe(true);
      await expect(auth.sync()).resolves.toEqual({
        session,
        synchronized: true,
      });
    },
  );
});

describe("isSynced", () => {
  it.each([
    [null, null, true],
    [null, "A", false],
    [first, null, false],
    [first, "A", true],
    [first, "B", false],
  ] as const)(
    "compares GAS %j and external %j without restoration or repair",
    async (gas, externalId, expected) => {
      const { auth, remote, externalAuth } = setup(gas, externalId);
      await auth.restoreSession();
      remote.getSession.mockClear();
      expect(await auth.isSynced()).toBe(expected);
      expect(remote.getSession).not.toHaveBeenCalled();
      expect(externalAuth.signIn).not.toHaveBeenCalled();
      expect(externalAuth.signOut).not.toHaveBeenCalled();
    },
  );

  it("compares the initial local state without restoring persisted GAS auth", async () => {
    const { auth, remote } = setup(first, null);
    expect(await auth.isSynced()).toBe(true);
    expect(auth.getSession()).toBeNull();
    expect(remote.getSession).not.toHaveBeenCalled();
  });

  it("propagates SDK failures", async () => {
    const { auth, externalAuth } = setup();
    const error = new Error("SDK unavailable");
    externalAuth.getUserId.mockRejectedValue(error);
    await expect(auth.isSynced()).rejects.toBe(error);
  });

  it("does not cancel an in-flight sign in", async () => {
    const { auth, remote } = setup(null);
    const pending = deferred<Session>();
    remote.signIn.mockReturnValue(pending.promise);
    const signingIn = auth.signIn({ email: "new" });
    expect(await auth.isSynced()).toBe(true);
    pending.resolve(second);
    await signingIn;
    expect(auth.getSession()).toBe(second);
  });
});

describe("external authentication concurrency", () => {
  it.each([
    "signIn",
    "signUp",
    "signOut",
    "restoreSession",
    "sync",
    "isSynced",
    "storage",
  ] as const)(
    "skips stale external repair after %s during ID lookup",
    async (method) => {
      const { auth, remote, externalAuth, storage } = setup();
      const pending = deferred<string | null>();
      const entered = deferred<void>();
      externalAuth.getUserId.mockImplementationOnce(() => {
        entered.resolve();
        return pending.promise;
      });
      const stale = auth.sync();
      await entered.promise;
      if (method === "signIn") await auth.signIn({ email: "new" });
      else if (method === "signUp") await auth.signUp({ name: "new" });
      else if (method === "storage") storage.set(second.token);
      else await auth[method]();
      externalAuth.signIn.mockClear();
      externalAuth.signOut.mockClear();
      const latest = auth.getSession();
      const token = storage.get();
      pending.resolve("B");
      expect((await stale).synchronized).toBe(false);
      expect(auth.getSession()).toBe(latest);
      expect(storage.get()).toBe(token);
      expect(externalAuth.signIn).not.toHaveBeenCalled();
      expect(externalAuth.signOut).not.toHaveBeenCalled();
      expect(remote.signOut).toHaveBeenCalledTimes(
        method === "signOut" ? 1 : 0,
      );
    },
  );

  it.each(["restore", "repair", "verification"])(
    "does not accept a stale sync during %s",
    async (stage) => {
      const { auth, remote, externalAuth, storage } = setup();
      const pendingSession = deferred<Session | null>();
      const pendingVoid = deferred<void>();
      const pendingId = deferred<string | null>();
      const entered = deferred<void>();
      if (stage === "restore")
        remote.getSession.mockImplementationOnce(() => {
          entered.resolve();
          return pendingSession.promise;
        });
      if (stage === "repair")
        externalAuth.signIn.mockImplementationOnce(() => {
          entered.resolve();
          return pendingVoid.promise;
        });
      if (stage === "verification")
        externalAuth.getUserId
          .mockResolvedValueOnce(null)
          .mockImplementationOnce(() => {
            entered.resolve();
            return pendingId.promise;
          });
      const stale = auth.sync();
      await entered.promise;
      await auth.signUp({ name: "new" });
      pendingSession.resolve(first);
      pendingVoid.resolve();
      pendingId.resolve("A");
      expect((await stale).synchronized).toBe(false);
      expect(auth.getSession()).toBe(second);
      expect(storage.get()).toBe(second.token);
      if (stage === "restore")
        expect(externalAuth.getUserId).not.toHaveBeenCalled();
    },
  );

  it.each(["sync", "isSynced", "signOut", "storage"] as const)(
    "does not accept stale isSynced after %s",
    async (method) => {
      const { auth, externalAuth, storage } = setup(first, "A");
      await auth.restoreSession();
      const pending = deferred<string | null>();
      externalAuth.getUserId.mockReturnValueOnce(pending.promise);
      const stale = auth.isSynced();
      if (method === "storage") storage.set(second.token);
      else await auth[method]();
      pending.resolve("A");
      expect(await stale).toBe(false);
    },
  );

  it("does not accept external sign out repair after a newer sign in", async () => {
    const { auth, externalAuth, storage } = setup(null, "A");
    const pending = deferred<void>();
    const entered = deferred<void>();
    externalAuth.signOut.mockImplementationOnce(() => {
      entered.resolve();
      return pending.promise;
    });
    const stale = auth.sync();
    await entered.promise;
    await auth.signIn({ email: "new" });
    pending.resolve();
    expect((await stale).synchronized).toBe(false);
    expect(auth.getSession()).toBe(second);
    expect(storage.get()).toBe(second.token);
  });

  it("propagates stale repair errors without replacing newer GAS auth", async () => {
    const { auth, externalAuth, storage } = setup();
    const pending = deferred<void>();
    const entered = deferred<void>();
    externalAuth.signIn.mockImplementationOnce(() => {
      entered.resolve();
      return pending.promise;
    });
    const stale = auth.sync();
    await entered.promise;
    await auth.signUp({ name: "new" });
    const error = new Error("Old SDK operation failed");
    pending.reject(error);
    await expect(stale).rejects.toBe(error);
    expect(storage.get()).toBe(second.token);
  });
});

describe("explicit external sign out", () => {
  it.each([first, null])(
    "awaits external sign out after GAS is cleared: %j",
    async (session) => {
      const { auth, externalAuth, storage, hooks } = setup(session, "A");
      const pending = deferred<void>();
      const entered = deferred<void>();
      externalAuth.signOut.mockImplementation(() => {
        expect(storage.get()).toBeNull();
        expect(auth.getState().isAuthenticated).toBe(false);
        entered.resolve();
        return pending.promise;
      });
      let completed = false;
      const signingOut = auth.signOut().then(() => {
        completed = true;
      });
      await entered.promise;
      expect(completed).toBe(false);
      expect(hooks.afterSignOut).not.toHaveBeenCalled();
      pending.resolve();
      await signingOut;
      expect(externalAuth.signOut).toHaveBeenCalledExactlyOnceWith();
      expect(hooks.afterSignOut).toHaveBeenCalledExactlyOnceWith();
    },
  );

  it("skips external sign out on GAS failure", async () => {
    const { auth, remote, externalAuth, storage } = setup(first, "A");
    const error = new Error("GAS failure");
    remote.signOut.mockRejectedValue(error);
    await expect(auth.signOut()).rejects.toBe(error);
    expect(storage.get()).toBe(first.token);
    expect(externalAuth.signOut).not.toHaveBeenCalled();
  });

  it("does not roll back GAS sign out when external sign out fails", async () => {
    const { auth, externalAuth, storage, hooks } = setup(first, "A");
    const error = new Error("SDK failure");
    externalAuth.signOut.mockRejectedValue(error);
    await expect(auth.signOut()).rejects.toBe(error);
    expect(storage.get()).toBeNull();
    expect(auth.getState().isAuthenticated).toBe(false);
    expect(hooks.afterSignOut).not.toHaveBeenCalled();
  });

  it.each(["signIn", "storage"] as const)(
    "skips the hook when %s supersedes pending external sign out",
    async (operation) => {
      const { auth, externalAuth, storage, hooks } = setup(first, "A");
      const pending = deferred<void>();
      const entered = deferred<void>();
      externalAuth.signOut.mockImplementationOnce(() => {
        entered.resolve();
        return pending.promise;
      });
      const stale = auth.signOut();
      await entered.promise;
      if (operation === "signIn") await auth.signIn({ email: "new" });
      else storage.set(second.token);
      pending.resolve();
      await stale;
      expect(hooks.afterSignOut).not.toHaveBeenCalled();
      expect(storage.get()).toBe(second.token);
    },
  );

  it("skips external sign out for a superseded GAS sign out", async () => {
    const { auth, remote, externalAuth } = setup();
    const pending = deferred<void>();
    remote.signOut.mockReturnValue(pending.promise);
    const stale = auth.signOut();
    await auth.signUp({ name: "new" });
    pending.resolve();
    await stale;
    expect(externalAuth.signOut).not.toHaveBeenCalled();
    expect(auth.getSession()).toBe(second);
  });
});

// The ID extractor must handle both restored and newly authenticated sessions.
function typeChecks() {
  const { remote, storage, externalAuth } = setup();
  // @ts-expect-error external integration requires getUserId
  authClient({ remote, storage, externalAuth });
  authClient({
    remote,
    storage,
    externalAuth,
    getUserId: (session) => {
      expectTypeOf(session).toEqualTypeOf<Session>();
      return session.user!.id;
    },
  });
}
void typeChecks;

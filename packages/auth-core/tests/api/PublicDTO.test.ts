import { describe, expect, it } from "vitest";
import { AccountDTO, SessionDTO, UserDTO } from "../../src";
import { Session } from "../../src/domain/Session";
import { User } from "../../src/domain/User";
import { AppsScriptAuthSession } from "../../src/api/AppsScriptAuthSession";
import { publicApiFixture } from "../helpers/publicApi";

const input = { name: "Taro", email: "user@example.com", password: "secret" };

function expectPublicUser(user: UserDTO<unknown>, withData = true) {
  expect(Object.keys(user).sort()).toEqual(
    withData ? ["data", "id", "name"] : ["id", "name"],
  );
  expect(user).not.toBeInstanceOf(User);
  const json = JSON.parse(JSON.stringify(user));
  expect(Object.keys(json).sort()).toEqual(Object.keys(user).sort());
  expect(json).not.toHaveProperty("accounts");
}
function expectPublicSession(session: SessionDTO) {
  expect(Object.keys(session).sort()).toEqual([
    "createdAt",
    "expiresAt",
    "id",
    "userId",
  ]);
  expect(session).not.toBeInstanceOf(Session);
  expect(Object.keys(JSON.parse(JSON.stringify(session))).sort()).toEqual(
    Object.keys(session).sort(),
  );
}

describe("public service DTO boundary", () => {
  for (const provider of ["email", "appsScript"] as const) {
    it.each([true, false])(
      `${provider} signup/signin preserve domains internally (hooks/data: %s)`,
      async (enabled) => {
        const { auth, users, hookUsers } = publicApiFixture(enabled, enabled);
        const signedUp = await auth.signUp[provider](input);
        const signedIn = await (provider === "email"
          ? auth.signIn.email(input)
          : auth.signIn.appsScript({}));
        for (const result of [signedUp, signedIn]) {
          expectPublicUser(result.user, enabled);
          expectPublicSession(result.session);
          expect(users.get(result.user.id)).toBeInstanceOf(User);
          if (enabled) {
            expect(result.user.data.permissions).toEqual(["read"]);
            expect(result.hooks).toEqual({ customToken: "public-token" });
          } else expect(result).not.toHaveProperty("hooks");
          const restored = await auth.session.getWithUser(result.session.id);
          expect(restored).not.toBeNull();
          expectPublicUser(restored!.user, enabled);
          expect(Object.keys(restored!).sort()).toEqual([
            "createdAt",
            "expiresAt",
            "id",
            "user",
            "userId",
          ]);
          expectPublicSession((await auth.session.get(result.session.id))!);
          const json = JSON.stringify({ result, restored });
          expect(json).not.toMatch(
            /accounts|identity|password|private-|futureSecret|hookSecret/,
          );
        }
        if (enabled) {
          expect(hookUsers).toHaveLength(2);
          for (const user of hookUsers) {
            expect(user).toBeInstanceOf(User);
            expect(user.accounts).toHaveLength(1);
          }
        }
        await auth.signOut.execute(signedIn.session.id);
        expect(await auth.session.get(signedIn.session.id)).toBeNull();
        expect(await auth.session.getWithUser(signedIn.session.id)).toBeNull();
      },
    );

    it(`${provider} registration and account linking return safe DTOs`, async () => {
      const { auth, users, accounts } = publicApiFixture();
      const user = await auth.registration[provider](input);
      expectPublicUser(user, false);
      expect(users.get(user.id)).toBeInstanceOf(User);
      const account = await auth.account.add(user.id, {
        provider: provider === "email" ? "appsScript" : "emailPassword",
        email: input.email,
        password: input.password,
      });
      expect(account).toBeInstanceOf(AccountDTO);
      expect(Object.keys(account).sort()).toEqual([
        "accountId",
        "id",
        "providerName",
        "userId",
      ]);
      expect(JSON.parse(JSON.stringify(account))).toEqual({
        id: account.id,
        userId: user.id,
        providerName: account.providerName,
        accountId: input.email,
      });
      expect(account).not.toHaveProperty("identity");
      expect(accounts).toHaveLength(2);
      expect(JSON.stringify({ user, account })).not.toMatch(
        /password|identity|accounts|private-/,
      );
    });
  }

  it("ignores future Session properties and retains domain expiry checks", async () => {
    const session = Object.assign(
      new Session({
        id: "session",
        userId: "user",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      }),
      { futureSecret: "secret" },
    );
    let deleted = false;
    const api = new AppsScriptAuthSession({
      sessionStorage: {
        save: async () => {},
        get: async () => session,
        delete: async () => {
          deleted = true;
        },
        cleanupExpired: async () => {},
      },
    });
    expectPublicSession((await api.get(session.id))!);
    session.expiresAt.setTime(0);
    expect(await api.get(session.id)).toBeNull();
    expect(deleted).toBe(true);
  });
});

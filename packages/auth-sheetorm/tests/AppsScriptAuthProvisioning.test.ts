import { AppsScriptAuth, User, createAuthTables } from "@gasboost/auth";
import { SheetDB, SheetTable } from "@gasboost/sheetorm";
import { describe, expect, it, vi } from "vitest";

import { SheetOrmAuthRepository } from "../src";
import { createRuntime } from "./runtime";
import { TestGateway } from "./TestGateway";

describe("Auth provisioning with the installed SheetORM version", () => {
  it.each([
    [true, false],
    [false, true],
    [true, true],
  ])(
    "recovers one User with enabled accounts: email=%s GAS=%s",
    async (emailPassword, appsScript) => {
      const definitions = createAuthTables();
      const runtime = createRuntime();
      const db = new SheetDB({
        tables: [
          new SheetTable({ ...definitions.user, dbId: "auth-db" }),
          new SheetTable({ ...definitions.account, dbId: "auth-db" }),
          new SheetTable({ ...definitions.passwordReset, dbId: "auth-db" }),
        ] as const,
        gateway: new TestGateway(),
        ...runtime,
      });
      db.migrate();
      const repository = new SheetOrmAuthRepository({
        db,
        schema: definitions.schema,
      });
      const email = "admin@example.com";
      const delivery = {
        send: vi.fn(async (_message: { token: string }) => {}),
      };
      const auth = new AppsScriptAuth({
        repository,
        session: { storageType: "cache" },
        runtime: {
          ...runtime,
          session: {
            getActiveUser: () => ({ getEmail: () => email }),
          } as GoogleAppsScript.Base.Session,
          propertiesService:
            {} as GoogleAppsScript.Properties.PropertiesService,
        },
        emailPassword: {
          enabled: emailPassword,
          pepper: "test-pepper",
          iterations: 1,
          passwordReset: { delivery },
        },
        appsScript: { enabled: appsScript },
      });
      // Recover a user-row write that stopped before the accounts were persisted.
      await repository.user.save(
        new User({ id: "admin", name: "Admin", accounts: [] }),
      );
      const input = {
        id: "admin",
        name: "Admin",
        email,
        password: "temporary-secret",
      };
      const user = await auth.registration.ensure(input);
      await auth.registration.ensure({
        ...input,
        password: "must-not-replace-existing-password",
      });
      expect(db.table("user").find()).toHaveLength(1);
      expect(db.table("account").find()).toHaveLength(
        emailPassword && appsScript ? 2 : 1,
      );
      expect(user.accounts.every((account) => account.userId === user.id)).toBe(
        true,
      );
      expect(
        (await repository.user.find(user.id))?.accounts.map(
          (account) => account.id,
        ),
      ).toEqual(user.accounts.map((account) => account.id));
      if (appsScript)
        expect((await auth.signIn.appsScript({})).session.userId).toBe(user.id);
      if (!emailPassword) return;
      expect(
        (await auth.signIn.email({ email, password: input.password })).session
          .userId,
      ).toBe(user.id);
      delivery.send.mockRejectedValueOnce(
        new Error("notification unavailable"),
      );
      await expect(auth.password.forgot({ email })).rejects.toThrow(
        "notification unavailable",
      );
      await auth.password.forgot({ email });
      const [oldMessage, currentMessage] = delivery.send.mock.calls.map(
        ([message]) => message,
      );
      expect(currentMessage.token).not.toBe(oldMessage.token);
      await expect(
        auth.password.reset({
          token: oldMessage.token,
          newPassword: "rejected-password",
        }),
      ).rejects.toThrow();
      await auth.password.reset({
        token: currentMessage.token,
        newPassword: "admin-chosen-password",
      });
      expect(
        (await auth.signIn.email({ email, password: "admin-chosen-password" }))
          .session.userId,
      ).toBe(user.id);
      expect(db.table("user").find()).toHaveLength(1);
      expect(db.table("account").find()).toHaveLength(appsScript ? 2 : 1);
    },
  );
});

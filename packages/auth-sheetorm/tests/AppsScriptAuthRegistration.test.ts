import { AppsScriptAuth, createAuthTables } from "@gasboost/auth";
import { SheetDB, SheetTable } from "@gasboost/sheetorm";
import { describe, expect, it, vi } from "vitest";

import { SheetOrmAuthRepository } from "../src";
import { createRuntime } from "./runtime";
import { TestGateway } from "./TestGateway";

describe("Registration and account linking with the installed SheetORM version", () => {
  it.each([
    [true, false, false],
    [false, true, true],
    [true, true, true],
    [true, true, false],
  ])(
    "creates one User: email=%s GAS=%s GAS first=%s",
    async (emailPassword, appsScript, appsScriptFirst) => {
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
      const getActiveUser = vi.fn(() => ({ getEmail: () => email }));
      const getEffectiveUser = vi.fn(() => {
        throw new Error("must not read EffectiveUser");
      });
      const auth = new AppsScriptAuth({
        repository,
        session: { storageType: "cache" },
        runtime: {
          ...runtime,
          session: {
            getActiveUser,
            getEffectiveUser,
          } as unknown as GoogleAppsScript.Base.Session,
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
      const input = { name: "Admin", email, password: "temporary-secret" };
      const user = appsScriptFirst
        ? await auth.registration.appsScript(input)
        : await auth.registration.email(input);
      if (emailPassword && appsScript) {
        await auth.account.add(
          user.id,
          appsScriptFirst
            ? {
                provider: "emailPassword",
                email,
                password: input.password,
              }
            : { provider: "appsScript", email },
        );
      }
      const stored = await repository.user.find(user.id);
      expect(db.table("user").find()).toHaveLength(1);
      expect(db.table("account").find()).toHaveLength(
        emailPassword && appsScript ? 2 : 1,
      );
      expect(user.accounts.every((account) => account.userId === user.id)).toBe(
        true,
      );
      expect(stored?.accounts).toHaveLength(
        emailPassword && appsScript ? 2 : 1,
      );
      expect(
        stored?.accounts.every((account) => account.userId === user.id),
      ).toBe(true);
      expect(getActiveUser).not.toHaveBeenCalled();
      expect(getEffectiveUser).not.toHaveBeenCalled();
      await expect(
        appsScriptFirst
          ? auth.registration.appsScript(input)
          : auth.registration.email(input),
      ).rejects.toThrow("Account already registered");
      if (emailPassword && appsScript) {
        await expect(
          auth.account.add(user.id, {
            provider: "emailPassword",
            email,
            password: "replacement",
          }),
        ).rejects.toThrow("already has an account");
      }
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

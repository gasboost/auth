import { AppsScript } from "@gasboost/app";
import { describe, expect, it, vi } from "vitest";

import { authentication, authorization } from "../src";
import type { AuthSession } from "../src/AuthState";

function createAuthentication(session: AuthSession | null) {
  return authentication({
    session: {
      get: vi.fn().mockResolvedValue(session),
    },
  } as never);
}

describe("authorization", () => {
  it.each(["get", "post"] as const)(
    "%s invocationはauthorization serviceを呼ばず通過する",
    async (invocationType) => {
      const can = vi.fn();
      const output = {} as GoogleAppsScript.Content.TextOutput;
      const app = new AppsScript().use(createAuthentication(null)).use(
        authorization({ can }, {
          project: ["read"],
        } as const),
      );

      const response = await (invocationType === "get"
        ? app.get(() => output).callGet({} as never)
        : app.post(() => output).callPost({} as never));

      expect(response).toBe(output);
      expect(can).not.toHaveBeenCalled();
    },
  );

  it("session.userIdを使ってauthorization serviceに委譲する", async () => {
    const session = {
      id: "session-1",
      userId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      isExpired: vi.fn(),
    };
    const can = vi.fn().mockResolvedValue(true);
    const requirement = {
      project: ["update"],
    } as const;

    const app = new AppsScript()
      .use(createAuthentication(session))
      .use(
        authorization(
          {
            can,
          },
          requirement,
        ),
      )
      .call("updateProject", () => {
        return {
          ok: true,
        };
      });

    const response = await app.dispatch("updateProject", {
      token: "session-1",
    });

    expect(can).toHaveBeenCalledWith("user-1", requirement);
    expect(response.contents).toBe(
      JSON.stringify({
        ok: true,
      }),
    );
  });

  it("authorization serviceがdenyした場合はForbiddenにする", async () => {
    const session = {
      id: "session-1",
      userId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      isExpired: vi.fn(),
    };

    const app = new AppsScript()
      .use(createAuthentication(session))
      .use(
        authorization(
          {
            can: vi.fn().mockResolvedValue(false),
          },
          {
            project: ["delete"],
          } as const,
        ),
      )
      .call("deleteProject", () => {
        return {
          ok: true,
        };
      });

    await expect(
      app.dispatch("deleteProject", {
        token: "session-1",
      }),
    ).rejects.toThrow("Forbidden");
  });
});

import { describe, expect, it, vi } from "vitest";
import { NodeUtilities } from "@gasboost/fake-node";
import { AppsScriptAuthUser } from "../../src/api/AppsScriptAuthUser";
import { User } from "../../src/domain/User";
import type { AppsScriptAuthRepository } from "../../src";

describe("server user management", () => {
  it("finds a stable ID and creates only an empty User for explicit account linking", async () => {
    const find = vi
      .fn<AppsScriptAuthRepository["user"]["find"]>()
      .mockResolvedValue(null);
    const create = vi.fn(async (user: User) => user);
    const repository = {
      user: { find, create },
    } as unknown as AppsScriptAuthRepository;
    const api = new AppsScriptAuthUser(repository, new NodeUtilities());
    const user = await api.create({ id: "stable", name: "Admin" });
    expect(user.id).toBe("stable");
    expect(user.accounts).toEqual([]);
    find.mockResolvedValue(user);
    expect(await api.find("stable")).toBe(user);
    await expect(api.create({ id: "stable", name: "Other" })).rejects.toThrow(
      "already registered",
    );
    expect(create).toHaveBeenCalledOnce();
  });
});

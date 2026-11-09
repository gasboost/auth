import { AppsScriptAuth } from "@gasboost/auth";
import { AppsScript } from "@gasboost/app";
import { expect, it } from "vitest";
import { publicApiFixture } from "../../auth-core/tests/helpers/publicApi";
import { authentication, handlers } from "../src";
import { AUTH_METADATA_KEY } from "@gasboost/auth-client/metadata";

it.each(["Email", "AppsScript"] as const)(
  "%s RPC returns only public fields",
  async (provider) => {
    const { config } = publicApiFixture();
    const auth = new AppsScriptAuth(config);
    const app = new AppsScript().calls(handlers(auth));
    const input = {
      name: "Taro",
      email: "user@example.com",
      password: "secret",
    };
    const signedUp = await app.dispatch(`signUp${provider}`, input);
    const result = JSON.parse(signedUp.contents);
    const signedIn = await app.dispatch(
      `signIn${provider}`,
      provider === "Email" ? input : {},
    );
    const restored = await app.dispatch("getSession", {
      sessionId: result.session.id,
    });
    for (const response of [signedUp, signedIn, restored]) {
      const json = JSON.parse(response.contents);
      expect(Object.keys(json.user).sort()).toEqual(["data", "id", "name"]);
      expect(json.user.data.permissions).toEqual(["read"]);
      expect(response.contents).not.toMatch(
        /accounts|identity|password|private-|futureSecret|hookSecret/,
      );
    }
    const protectedApp = new AppsScript()
      .use(authentication(auth))
      .call(
        "protected",
        (_input: Record<never, never>, context) =>
          context.state.get("session").userId,
      );
    expect(
      (
        await protectedApp.dispatch(
          "protected",
          {},
          { [AUTH_METADATA_KEY]: { token: result.session.id } },
        )
      ).contents,
    ).toBe(JSON.stringify(result.user.id));
  },
);

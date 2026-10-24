import { AppsScript, type InferAppsScript } from "@gasboost/app";
import {
  AppsScriptAuth,
  type User,
  type AppsScriptAuthRepository,
} from "@gasboost/auth";
import { authentication, handlers } from "@gasboost/auth-app";
import {
  appsScriptAuth,
  authMetadataProvider,
} from "@gasboost/auth-client/appsscript";
import { memoryAuthStorage } from "@gasboost/auth-client";
import { AUTH_METADATA_KEY } from "@gasboost/auth-client/metadata";
import { appsScriptClient } from "@gasboost/client";
import {
  InMemoryCacheService,
  InMemoryContext,
  InMemoryPropertiesService,
  InMemorySession,
  OAuthScope,
  SecurityPolicy,
} from "@gasboost/fake-core";
import { NodeUtilities } from "@gasboost/fake-node";
import { generateKeyPairSync, createPublicKey, verify } from "node:crypto";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { FirebaseAuthHook, firebaseAuthHandlers } from "../src";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
function payload(token: string) {
  const [header, body, signature] = token.split(".");
  expect(
    verify(
      "RSA-SHA256",
      Buffer.from(`${header}.${body}`),
      createPublicKey(privateKey),
      Buffer.from(signature!, "base64url"),
    ),
  ).toBe(true);
  return JSON.parse(Buffer.from(body!, "base64url").toString("utf8"));
}
function setup(expiresIn = 1200) {
  let saved: User | null = null;
  const repository = {
    user: {
      find: vi.fn(async () => saved),
      create: vi.fn(async (user: User) => {
        saved = user;
        return user;
      }),
    },
    account: { findByIdentity: vi.fn(async () => saved?.accounts[0] ?? null) },
    passwordCredential: {
      findByResetTokenHash: vi.fn(async () => null),
      save: vi.fn(async () => {}),
    },
  } satisfies AppsScriptAuthRepository;
  const claims = vi.fn(({ session }: import("../src").FirebaseAuthContext) => ({
    authSessionId: session.id,
  }));
  const hook = new FirebaseAuthHook({
    serviceAccount: {
      email: "firebase-admin@example.iam.gserviceaccount.com",
      privateKey,
    },
    utilities: new NodeUtilities(),
    claims,
  });
  const afterSignIn = vi.spyOn(hook, "afterSignIn");
  const auth = new AppsScriptAuth({
    repository,
    runtime: {
      utilities: new NodeUtilities(),
      cacheService: new InMemoryCacheService(),
      propertiesService: new InMemoryPropertiesService(),
      session: new InMemorySession(
        new InMemoryContext(
          "owner@example.com",
          "user@example.com",
          { type: "WEB_APP", executeAs: "USER" },
          new SecurityPolicy([OAuthScope.USERINFO_EMAIL]),
          "ja",
          "Asia/Tokyo",
        ),
      ),
    },
    session: { storageType: "properties", expiresIn },
    appsScript: { enabled: true, isSignupEnabled: true },
    hooks: { afterSignIn: hook.afterSignIn },
  });
  const app = new AppsScript()
    .calls(handlers(auth))
    .use(authentication(auth))
    .calls(firebaseAuthHandlers(hook));
  const storage = memoryAuthStorage();
  const { client } = appsScriptClient<InferAppsScript<typeof app>>({
    transport: {
      call: (name, input, metadata) => app.dispatch(name, input, metadata),
    },
    metadataProviders: [authMetadataProvider(storage)],
  });
  return { app, client, storage, auth, hook, afterSignIn, claims, repository };
}

describe("firebaseAuthHandlers", () => {
  it("reuses the sign-in hook and claims with the existing authenticated session", async () => {
    const { client, storage, auth, afterSignIn, claims, repository } = setup();
    const signedUp = await client.signUpAppsScript({ name: "Taro" });
    storage.set(signedUp.session.id);
    const signedIn = await client.signInAppsScript({});
    storage.set(signedIn.session.id);
    const state = await auth.session.get(signedIn.session.id);
    expect(afterSignIn).toHaveBeenCalledTimes(2);
    const initial = payload(signedIn.hooks.customToken);
    const result = await client.issueFirebaseCustomToken();
    expectTypeOf(result.customToken).toEqualTypeOf<string>();
    expectTypeOf<
      InferAppsScript<
        ReturnType<typeof setup>["app"]
      >["issueFirebaseCustomToken"]["result"]
    >().toEqualTypeOf<{ readonly customToken: string }>();
    const renewed = payload(result.customToken);
    expect(renewed.uid).toBe(signedIn.session.userId);
    expect(renewed.claims).toEqual(initial.claims);
    expect(claims).toHaveBeenLastCalledWith({ session: state });
    expect(afterSignIn).toHaveBeenCalledTimes(3);
    expect(afterSignIn).toHaveBeenLastCalledWith({ session: state });
    expect(await auth.session.get(signedIn.session.id)).toEqual(state);
    // Only signup/signin access the account and user repository.
    expect(repository.user.create).toHaveBeenCalledOnce();
    expect(repository.account.findByIdentity).toHaveBeenCalledTimes(2);
    expect(repository.user.find).toHaveBeenCalledOnce();
  });

  it.each(["missing", "unknown", "expired"])(
    "does not issue tokens for %s sessions",
    async (kind) => {
      const { client, storage, afterSignIn, claims } = setup(
        kind === "expired" ? -1 : 1200,
      );
      if (kind === "expired") {
        const signedUp = await client.signUpAppsScript({ name: "Taro" });
        storage.set(signedUp.session.id);
      } else if (kind === "unknown") storage.set("not-a-session");
      afterSignIn.mockClear();
      claims.mockClear();
      await expect(client.issueFirebaseCustomToken()).rejects.toThrow(
        "Unauthorized",
      );
      expect(afterSignIn).not.toHaveBeenCalled();
      expect(claims).not.toHaveBeenCalled();
    },
  );

  it("ignores forged user/session inputs and signs only the verified session subject", async () => {
    const { app, client, afterSignIn } = setup();
    const signedUp = await client.signUpAppsScript({ name: "Taro" });
    const response = await app.dispatch(
      "issueFirebaseCustomToken",
      {
        userId: "attacker",
        sessionId: "forged",
        session: { userId: "attacker" },
      },
      { [AUTH_METADATA_KEY]: { token: signedUp.session.id } },
    );
    const { customToken } = JSON.parse(response.contents);
    expect(payload(customToken).uid).toBe(signedUp.session.userId);
    expect(afterSignIn).toHaveBeenLastCalledWith({
      session: expect.objectContaining({ userId: signedUp.session.userId }),
    });
  });

  it("repairs Firebase auth through auth.sync without creating a GAS session", async () => {
    const { client, storage, afterSignIn } = setup();
    const signedUp = await client.signUpAppsScript({ name: "Taro" });
    storage.set(signedUp.session.id);
    let uid: string | null = null;
    const auth = appsScriptAuth({
      client,
      storage,
      getUserId: (result) => result.session.userId,
      externalAuth: {
        getUserId: async () => uid,
        signIn: async () => {
          const { customToken } = await client.issueFirebaseCustomToken();
          uid = payload(customToken).uid;
        },
        signOut: async () => {
          uid = null;
        },
      },
    });
    const result = await auth.sync();
    expect(result.synchronized).toBe(true);
    expect(uid).toBe(signedUp.session.userId);
    expect(result.session?.token).toBe(signedUp.session.id);
    expect(storage.get()).toBe(signedUp.session.id);
    expect(afterSignIn).toHaveBeenCalledTimes(2);
  });

  it("propagates token issuance failures", async () => {
    const { client, storage, afterSignIn } = setup();
    const signedUp = await client.signUpAppsScript({ name: "Taro" });
    storage.set(signedUp.session.id);
    afterSignIn.mockImplementation(() => {
      throw new Error("Signing failed");
    });
    await expect(client.issueFirebaseCustomToken()).rejects.toThrow(
      "Signing failed",
    );
    expect(storage.get()).toBe(signedUp.session.id);
  });
});

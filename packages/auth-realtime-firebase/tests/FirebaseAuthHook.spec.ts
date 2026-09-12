import { User, type AfterSignInContext } from "@gasboost/auth";
import { NodeUtilities } from "@gasboost/fake-node";
import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FirebaseAuthHook } from "../src/FirebaseAuthHook";

describe("FirebaseAuthHook", () => {
  const utilities = new NodeUtilities();

  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  const serviceAccount = {
    email: "firebase-adminsdk@example.iam.gserviceaccount.com",
    privateKey,
  };

  const user = new User({
    id: "user-1",
    name: "Taro",
    accounts: [],
  });

  const session = {
    id: "session-1",
    userId: "user-1",
    createdAt: new Date("2026-09-13T00:00:00.000Z"),
    expiresAt: new Date("2026-09-13T01:00:00.000Z"),

    isExpired(now: Date): boolean {
      return now > this.expiresAt;
    },
  };

  const context = {
    user,
    session,
  } satisfies AfterSignInContext;

  it("user.idをFirebase uidとしてCustom Tokenを生成する", () => {
    const firebase = new FirebaseAuthHook({
      serviceAccount,
      utilities,
    });

    const result = firebase.afterSignIn(context);

    expect(result).not.toBeInstanceOf(Promise);

    const { customToken } = result as {
      customToken: string;
    };

    const [, payloadSegment] = customToken.split(".");

    const payload = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    );

    expect(payload.uid).toBe("user-1");
  });

  it("claims factoryの結果をCustom Tokenに渡す", () => {
    const firebase = new FirebaseAuthHook({
      serviceAccount,
      utilities,
      claims: () => ({
        storeId: "store-1",
        role: "manager",
      }),
    });

    const result = firebase.afterSignIn(context);

    const { customToken } = result as {
      customToken: string;
    };

    const [, payloadSegment] = customToken.split(".");

    const payload = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    );

    expect(payload.claims).toEqual({
      storeId: "store-1",
      role: "manager",
    });
  });

  it("claimsを省略できる", () => {
    const firebase = new FirebaseAuthHook({
      serviceAccount,
      utilities,
    });

    const result = firebase.afterSignIn(context);

    const { customToken } = result as {
      customToken: string;
    };

    const [, payloadSegment] = customToken.split(".");

    const payload = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    );

    expect(payload).not.toHaveProperty("claims");
  });

  it("claims factoryからUserを参照できる", () => {
    const firebase = new FirebaseAuthHook({
      serviceAccount,
      utilities,
      claims: ({ user }) => ({
        userName: user.name,
      }),
    });

    const result = firebase.afterSignIn(context);

    const { customToken } = result as {
      customToken: string;
    };

    const [, payloadSegment] = customToken.split(".");

    const payload = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    );

    expect(payload.claims).toEqual({
      userName: "Taro",
    });
  });

  it("claims factoryからSessionを参照できる", () => {
    const firebase = new FirebaseAuthHook({
      serviceAccount,
      utilities,
      claims: ({ session }) => ({
        authSessionId: session.id,
      }),
    });

    const result = firebase.afterSignIn(context);

    const { customToken } = result as {
      customToken: string;
    };

    const [, payloadSegment] = customToken.split(".");

    const payload = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    );

    expect(payload.claims).toEqual({
      authSessionId: "session-1",
    });
  });

  it("FirebaseCustomToken.generateのerrorを伝播する", () => {
    const firebase = new FirebaseAuthHook({
      serviceAccount: {
        email: serviceAccount.email,
        privateKey: "",
      },
      utilities,
    });

    expect(() => firebase.afterSignIn(context)).toThrow(
      "Firebase service account private key must not be empty",
    );
  });

  it("customTokenをhook resultとして返す", () => {
    const firebase = new FirebaseAuthHook({
      serviceAccount,
      utilities,
    });

    const result = firebase.afterSignIn(context);

    expect(result).toEqual({
      customToken: expect.any(String),
    });
  });
});

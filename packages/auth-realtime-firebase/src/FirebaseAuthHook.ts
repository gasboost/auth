import type { AfterSignInContext } from "@gasboost/auth";
import {
  FirebaseCustomToken,
  type FirebaseCustomClaims,
  type FirebaseCustomTokenUtilities,
  type FirebaseServiceAccount,
} from "@gasboost/realtime-firebase";

export type FirebaseAuthContext = {
  readonly session: AfterSignInContext["session"];
};

export type FirebaseAuthHookResult = {
  readonly customToken: string;
};

export class FirebaseAuthHook {
  private readonly serviceAccount: FirebaseServiceAccount;
  private readonly utilities: FirebaseCustomTokenUtilities;
  private readonly claims:
    ((context: FirebaseAuthContext) => FirebaseCustomClaims) | undefined;

  constructor({
    serviceAccount,
    utilities,
    claims,
  }: {
    serviceAccount: FirebaseServiceAccount;
    utilities: FirebaseCustomTokenUtilities;
    claims?: (context: FirebaseAuthContext) => FirebaseCustomClaims;
  }) {
    this.serviceAccount = serviceAccount;
    this.utilities = utilities;
    this.claims = claims;
  }

  public readonly afterSignIn = ({
    session,
  }: FirebaseAuthContext): FirebaseAuthHookResult => {
    return {
      customToken: FirebaseCustomToken.generate({
        uid: session.userId,
        claims: this.claims?.({ session }),
        serviceAccount: this.serviceAccount,
        utilities: this.utilities,
      }),
    };
  };
}

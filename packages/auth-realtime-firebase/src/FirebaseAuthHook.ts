import type { AfterSignInContext, AfterSignInHook } from "@gasboost/auth";
import {
  FirebaseCustomToken,
  type FirebaseCustomClaims,
  type FirebaseCustomTokenUtilities,
  type FirebaseServiceAccount,
} from "@gasboost/realtime-firebase";

export type FirebaseAuthHookResult = {
  readonly customToken: string;
};

export class FirebaseAuthHook {
  private readonly serviceAccount: FirebaseServiceAccount;
  private readonly utilities: FirebaseCustomTokenUtilities;
  private readonly claims:
    ((context: AfterSignInContext) => FirebaseCustomClaims) | undefined;

  constructor({
    serviceAccount,
    utilities,
    claims,
  }: {
    serviceAccount: FirebaseServiceAccount;
    utilities: FirebaseCustomTokenUtilities;
    claims?: (context: AfterSignInContext) => FirebaseCustomClaims;
  }) {
    this.serviceAccount = serviceAccount;
    this.utilities = utilities;
    this.claims = claims;
  }

  public readonly afterSignIn: AfterSignInHook<FirebaseAuthHookResult> = (
    context,
  ) => {
    return {
      customToken: FirebaseCustomToken.generate({
        uid: context.user.id,
        claims: this.claims?.(context),
        serviceAccount: this.serviceAccount,
        utilities: this.utilities,
      }),
    };
  };
}

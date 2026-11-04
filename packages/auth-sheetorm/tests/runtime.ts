import { InMemoryCacheService } from "@gasboost/fake-core";
import { NodeLockService, NodeUtilities } from "@gasboost/fake-node";

/** A spread of this runtime also works with v3, which has no lockService option. */
export function createRuntime(utilities = new NodeUtilities()) {
  return {
    cacheService: new InMemoryCacheService(),
    utilities,
    lockService: new NodeLockService({
      scriptId: utilities.getUuid(),
      userId: "test-user",
    }),
  };
}

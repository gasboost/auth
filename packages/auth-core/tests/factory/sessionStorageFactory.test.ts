import {
  InMemoryCacheService,
  InMemoryPropertiesService,
} from "@gasboost/fake-core";
import { describe, expect, it } from "vitest";

import { sessionStorageFactory } from "../../src/factory/sessionStorageFactory";
import { AppsScriptCacheSessionStorage } from "../../src/storage/AppsScriptCacheSessionStorage";
import { AppsScriptPropertiesSessionStorage } from "../../src/storage/AppsScriptPropertiesSessionStorage";

describe("sessionStorageFactory", () => {
  it("cacheを指定するとAppsScriptCacheSessionStorageを返す", () => {
    const storage = sessionStorageFactory("cache", {
      cacheService: new InMemoryCacheService(),
      propertiesService: new InMemoryPropertiesService(),
    });

    expect(storage).toBeInstanceOf(AppsScriptCacheSessionStorage);
  });

  it("propertiesを指定するとAppsScriptPropertiesSessionStorageを返す", () => {
    const storage = sessionStorageFactory("properties", {
      cacheService: new InMemoryCacheService(),
      propertiesService: new InMemoryPropertiesService(),
    });

    expect(storage).toBeInstanceOf(AppsScriptPropertiesSessionStorage);
  });
});

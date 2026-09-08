import { AppsScriptCacheSessionStorage } from "../storage/AppsScriptCacheSessionStorage";
import { AppsScriptPropertiesSessionStorage } from "../storage/AppsScriptPropertiesSessionStorage";
import type { AppsScriptSessionStorage } from "../storage/AppsScriptSessionStorage";

export type SessionStorageType = "properties" | "cache";

export function sessionStorageFactory(
  storage: SessionStorageType,
  {
    cacheService,
    propertiesService,
  }: {
    cacheService: GoogleAppsScript.Cache.CacheService;
    propertiesService: GoogleAppsScript.Properties.PropertiesService;
  },
): AppsScriptSessionStorage {
  if (storage === "properties") {
    return new AppsScriptPropertiesSessionStorage(
      propertiesService.getScriptProperties(),
    );
  }

  if (storage === "cache") {
    return new AppsScriptCacheSessionStorage(cacheService.getScriptCache());
  }

  throw new Error("Invalid storage type");
}

import { AppsScriptCacheSessionStorage } from "../storage/AppsScriptCacheSessionStorage";
import { AppsScriptPropertiesSessionStorage } from "../storage/AppsScriptPropertiesSessionStorage";
import type { AppsScriptSessionStorage } from "../storage/AppsScriptSessionStorage";

export type SessionStorageType = "properties" | "cache";

export function sessionStorageFactory(
  storage: SessionStorageType,
): AppsScriptSessionStorage {
  if (storage === "properties") {
    return new AppsScriptPropertiesSessionStorage(
      PropertiesService.getScriptProperties(),
    );
  } else if (storage === "cache") {
    return new AppsScriptCacheSessionStorage(CacheService.getScriptCache());
  }
  throw new Error("Invalid storage type");
}

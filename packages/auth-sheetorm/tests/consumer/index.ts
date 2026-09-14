import { AuthSchemaConfig } from "@gasboost/auth";
import { createAuthSchema } from "@gasboost/auth-sheetorm";
import { SheetDB } from "@gasboost/sheetorm";

const config = new AuthSchemaConfig({
  dbId: "spreadsheet-id",
});

const tables = createAuthSchema(config.schema);

new SheetDB({
  tables,
  gateway: {} as never,
  cacheService: {} as never,
  utilities: {} as never,
});

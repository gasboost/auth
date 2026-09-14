import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

const rootDirectory = resolve(scriptDirectory, "..");

const authDirectory = join(rootDirectory, "packages", "auth-core");

const authSheetOrmDirectory = join(rootDirectory, "packages", "auth-sheetorm");

const temporaryDirectory = mkdtempSync(
  join(tmpdir(), "gasboost-auth-sheetorm-"),
);

const packageDirectory = join(temporaryDirectory, "packages");

const consumerDirectory = join(temporaryDirectory, "consumer");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDirectory,
    encoding: "utf-8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.status !== 0) {
    if (options.capture) {
      process.stderr.write(result.stdout ?? "");

      process.stderr.write(result.stderr ?? "");
    }

    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }

  return result.stdout?.trim() ?? "";
}

function findTarball(packageName) {
  const prefix = packageName.replace(/^@/, "").replace("/", "-");

  const tarball = readdirSync(packageDirectory).find(
    (fileName) => fileName.startsWith(prefix) && fileName.endsWith(".tgz"),
  );

  if (!tarball) {
    throw new Error(`Tarball not found for ${packageName}`);
  }

  return join(packageDirectory, tarball);
}

function readPackedPackageJson(tarball) {
  const content = run("tar", ["-xOf", tarball, "package/package.json"], {
    capture: true,
  });

  return JSON.parse(content);
}

function ensurePeerDependency({ packageJson, packageName, version }) {
  if (packageJson.dependencies?.[packageName] !== undefined) {
    throw new Error(`${packageName} must not be included in dependencies`);
  }

  if (packageJson.peerDependencies?.[packageName] !== version) {
    throw new Error(`${packageName} peerDependency must be "${version}"`);
  }
}

try {
  mkdirSync(packageDirectory, {
    recursive: true,
  });

  mkdirSync(consumerDirectory, {
    recursive: true,
  });

  run("pnpm", ["--filter", "@gasboost/auth", "build"]);

  run("pnpm", ["--filter", "@gasboost/auth-sheetorm", "build"]);

  run("pnpm", ["pack", "--pack-destination", packageDirectory], {
    cwd: authDirectory,
  });

  run("pnpm", ["pack", "--pack-destination", packageDirectory], {
    cwd: authSheetOrmDirectory,
  });

  const authTarball = findTarball("@gasboost/auth");

  const authSheetOrmTarball = findTarball("@gasboost/auth-sheetorm");

  const packedPackageJson = readPackedPackageJson(authSheetOrmTarball);

  ensurePeerDependency({
    packageJson: packedPackageJson,
    packageName: "@gasboost/auth",
    version: "^0.2.0",
  });

  ensurePeerDependency({
    packageJson: packedPackageJson,
    packageName: "@gasboost/sheetorm",
    version: "^2.0.0",
  });

  writeFileSync(
    join(consumerDirectory, "package.json"),
    JSON.stringify(
      {
        name: "auth-sheetorm-pack-smoke",
        private: true,
        dependencies: {
          "@gasboost/auth": `file:${authTarball}`,
          "@gasboost/auth-sheetorm": `file:${authSheetOrmTarball}`,
          "@gasboost/sheetorm": "2.0.0",
          typescript: "^7.0.0-dev.20260901",
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(consumerDirectory, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          module: "nodenext",
          moduleResolution: "nodenext",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ["index.ts"],
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(consumerDirectory, "index.ts"),
    `import {
  AppsScriptAuth,
  AuthSchemaConfig,
} from "@gasboost/auth";

import {
  createAuthSchema,
  SheetOrmAuthRepository,
} from "@gasboost/auth-sheetorm";

import {
  SheetDB,
} from "@gasboost/sheetorm";

const authSchemaConfig =
  new AuthSchemaConfig({
    dbId: "spreadsheet-id",
  });

const tables =
  createAuthSchema(
    authSchemaConfig.schema,
  );

const db = new SheetDB({
  tables,
  gateway: {} as never,
  cacheService: {} as never,
  utilities: {} as never,
});

const repository =
  new SheetOrmAuthRepository({
    db,
    schema:
      authSchemaConfig.schema,
    tables,
  });

new AppsScriptAuth({
  appsScript: {
    enabled: true,
    isSignupEnabled: true,
  },

  runtime: {
    cacheService: {} as never,
    propertiesService: {} as never,
    session: {} as never,
    utilities: {} as never,
  },

  repository,

  session: {
    storageType: "cache",
  },
});
`,
  );

  run("pnpm", ["install"], {
    cwd: consumerDirectory,
  });

  run("pnpm", [
    "exec",
    "tsc",
    "--noEmit",
    "-p",
    join(consumerDirectory, "tsconfig.json"),
  ]);

  console.log("@gasboost/auth-sheetorm package smoke test passed.");
} finally {
  rmSync(temporaryDirectory, {
    recursive: true,
    force: true,
  });
}

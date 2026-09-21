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
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

const rootDirectory = resolve(scriptDirectory, "..");

const packages = [
  {
    name: "@gasboost/auth",
    directory: join(rootDirectory, "packages", "auth-core"),
    exports: [
      "AppsScriptAuth",
      "AppsScriptAuthorization",
      "createAuthTables",
      "createAuthorizationTables",
    ],
    subpathExports: {
      "./authorization": ["AuthorizationPolicy"],
    },
  },
  {
    name: "@gasboost/auth-app",
    directory: join(rootDirectory, "packages", "auth-app"),
    exports: [
      "authentication",
      "authorization",
      "authorizationHandlers",
      "handlers",
    ],
  },
  {
    name: "@gasboost/auth-sheetorm",
    directory: join(rootDirectory, "packages", "auth-sheetorm"),
    exports: ["SheetOrmAuthRepository", "SheetOrmAuthorizationRepository"],
    peers: {
      "@gasboost/auth": "^0.4.0",
      "@gasboost/sheetorm": "^3.1.0",
    },
  },
  {
    name: "@gasboost/auth-realtime-firebase",
    directory: join(rootDirectory, "packages", "auth-realtime-firebase"),
    exports: ["FirebaseAuthHook"],
  },
];

const temporaryDirectory = mkdtempSync(join(tmpdir(), "gasboost-auth-pack-"));

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

function ensureCommonJsPackage({ packageJson, packageName }) {
  if (packageJson.type !== "commonjs") {
    throw new Error(`${packageName} package type must be "commonjs"`);
  }
}

function ensurePeerDependencies({ packageJson, packageName, peers = {} }) {
  for (const [peerName, version] of Object.entries(peers)) {
    if (packageJson.dependencies?.[peerName] !== undefined) {
      throw new Error(
        `${packageName} must not include ${peerName} in dependencies`,
      );
    }

    if (packageJson.peerDependencies?.[peerName] !== version) {
      throw new Error(
        `${packageName} peerDependency ${peerName} must be "${version}"`,
      );
    }
  }
}

try {
  mkdirSync(packageDirectory, {
    recursive: true,
  });

  mkdirSync(consumerDirectory, {
    recursive: true,
  });

  for (const packageMetadata of packages) {
    run("pnpm", ["--filter", packageMetadata.name, "build"]);

    run("pnpm", ["pack", "--pack-destination", packageDirectory], {
      cwd: packageMetadata.directory,
    });
  }

  const tarballs = new Map(
    packages.map((packageMetadata) => [
      packageMetadata.name,
      findTarball(packageMetadata.name),
    ]),
  );

  for (const packageMetadata of packages) {
    const packageJson = readPackedPackageJson(
      tarballs.get(packageMetadata.name),
    );

    ensureCommonJsPackage({
      packageJson,
      packageName: packageMetadata.name,
    });

    ensurePeerDependencies({
      packageJson,
      packageName: packageMetadata.name,
      peers: packageMetadata.peers,
    });
  }

  writeFileSync(
    join(consumerDirectory, "package.json"),
    JSON.stringify(
      {
        name: "auth-pack-smoke",
        private: true,
        dependencies: {
          "@gasboost/app": "^5.0.0",
          "@gasboost/auth": `file:${tarballs.get("@gasboost/auth")}`,
          "@gasboost/auth-app": `file:${tarballs.get("@gasboost/auth-app")}`,
          "@gasboost/auth-realtime-firebase": `file:${tarballs.get(
            "@gasboost/auth-realtime-firebase",
          )}`,
          "@gasboost/auth-sheetorm": `file:${tarballs.get(
            "@gasboost/auth-sheetorm",
          )}`,
          "@gasboost/realtime-firebase": "^0.2.0",
          "@gasboost/sheetorm": "^3.1.0",
          typescript: "^7.0.0-dev.20260901",
        },
        pnpm: {
          overrides: Object.fromEntries(
            packages.map((packageMetadata) => [
              packageMetadata.name,
              `file:${tarballs.get(packageMetadata.name)}`,
            ]),
          ),
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(consumerDirectory, "require.cjs"),
    packages
      .map(
        (packageMetadata) => `{
  const actual = require("${packageMetadata.name}");
  for (const exportName of ${JSON.stringify(packageMetadata.exports)}) {
    if (actual[exportName] === undefined) {
      throw new Error("${packageMetadata.name} missing export " + exportName);
    }
  }
  for (const [subpath, exportNames] of Object.entries(${JSON.stringify(
    packageMetadata.subpathExports ?? {},
  )})) {
    const subpathActual = require("${packageMetadata.name}" + subpath.slice(1));
    for (const exportName of exportNames) {
      if (subpathActual[exportName] === undefined) {
        throw new Error("${packageMetadata.name}" + subpath + " missing export " + exportName);
      }
    }
  }
}`,
      )
      .join("\n\n"),
  );

  writeFileSync(
    join(consumerDirectory, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          module: "Node16",
          moduleResolution: "Node16",
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
  createAuthTables,
} from "@gasboost/auth";

import {
  authentication,
  handlers,
} from "@gasboost/auth-app";

import {
  FirebaseAuthHook,
} from "@gasboost/auth-realtime-firebase";

import {
  SheetOrmAuthRepository,
} from "@gasboost/auth-sheetorm";

import {
  SheetDB,
  SheetTable,
} from "@gasboost/sheetorm";

const definitions = createAuthTables();

const tables = [
  new SheetTable({ ...definitions.user, dbId: "spreadsheet-id" }),
  new SheetTable({ ...definitions.account, dbId: "spreadsheet-id" }),
  new SheetTable({ ...definitions.passwordReset, dbId: "spreadsheet-id" }),
] as const;

const db = new SheetDB({
  tables,
  gateway: {} as never,
  cacheService: {} as never,
  utilities: {} as never,
});

const repository =
  new SheetOrmAuthRepository({
    db,
    schema: definitions.schema,
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

authentication({} as never);
void handlers;
new FirebaseAuthHook({} as never);
`,
  );

  run("pnpm", ["install"], {
    cwd: consumerDirectory,
  });

  run("node", [join(consumerDirectory, "require.cjs")]);

  run("pnpm", [
    "exec",
    "tsc",
    "--noEmit",
    "-p",
    join(consumerDirectory, "tsconfig.json"),
  ]);

  process.stdout.write("Auth package smoke test passed.\n");
} finally {
  rmSync(temporaryDirectory, {
    recursive: true,
    force: true,
  });
}

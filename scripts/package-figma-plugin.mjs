#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

const distDir = join(repoRoot, "dist");
const devManifestPath = join(repoRoot, "manifest.json");
const prodManifestPath = join(repoRoot, "manifest.prod.json");
const uiEntry = join(distDir, "ui", "index.html");
const mainEntry = join(distDir, "main.js");

if (!existsSync(distDir)) {
  console.error("[package:figma] dist/ directory not found. Run `npm run build` first.");
  process.exit(1);
}

if (!existsSync(mainEntry)) {
  console.error(
    "[package:figma] dist/main.js is missing. Rebuild the plugin before packaging."
  );
  process.exit(1);
}

if (!existsSync(uiEntry)) {
  console.error(
    "[package:figma] dist/ui/index.html is missing. Rebuild the UI before packaging."
  );
  process.exit(1);
}

const DEFAULT_PACKAGE_NAME = "uxbiblio-figma-plugin";
const legacyDistZip = join(distDir, `${DEFAULT_PACKAGE_NAME}.zip`);
const resolvedLegacyDistZip = resolve(legacyDistZip);

const requestedEnv = (process.env.UXBIBLIO_FIGMA_PACKAGE_ENV ?? "prod").trim();
const safeEnvSegment =
  requestedEnv.length > 0 ? requestedEnv.replace(/[^a-z0-9_-]/gi, "-").toLowerCase() : "prod";
const defaultSubmissionDir = join(repoRoot, "submission", safeEnvSegment);
const isProdEnv = safeEnvSegment === "prod";
const manifestSourcePath = isProdEnv ? prodManifestPath : devManifestPath;
if (!existsSync(manifestSourcePath)) {
  const missingLabel = isProdEnv ? "manifest.prod.json" : "manifest.json";
  console.error(`[package:figma] ${missingLabel} is missing. Cannot build submission package.`);
  process.exit(1);
}
const packageBaseName = isProdEnv ? DEFAULT_PACKAGE_NAME : `${DEFAULT_PACKAGE_NAME}-DEV`;
const legacyDevZip = join(defaultSubmissionDir, `${DEFAULT_PACKAGE_NAME}.zip`);
const legacyDevDir = join(defaultSubmissionDir, DEFAULT_PACKAGE_NAME);
const stageDir = join(defaultSubmissionDir, `${packageBaseName}__stage`);

const packageEnvPath = process.env.UXBIBLIO_FIGMA_PACKAGE_PATH;
const packagePath = resolve(
  packageEnvPath && packageEnvPath.length > 0
    ? packageEnvPath
    : join(defaultSubmissionDir, `${packageBaseName}.zip`)
);

const packageDir = dirname(packagePath);
if (!existsSync(packageDir)) {
  mkdirSync(packageDir, { recursive: true });
}

if (existsSync(legacyDistZip) && resolvedLegacyDistZip !== packagePath) {
  rmSync(legacyDistZip, { force: true });
}

if (existsSync(packagePath)) {
  rmSync(packagePath);
}

if (!isProdEnv) {
  if (existsSync(legacyDevZip)) {
    rmSync(legacyDevZip, { force: true });
  }
  if (existsSync(legacyDevDir)) {
    rmSync(legacyDevDir, { recursive: true, force: true });
  }
}

if (existsSync(stageDir)) {
  rmSync(stageDir, { recursive: true, force: true });
}
mkdirSync(stageDir, { recursive: true });

const stageManifestPath = join(stageDir, "manifest.json");
const stageDistDir = join(stageDir, "dist");

const manifestRaw = readFileSync(manifestSourcePath, "utf8");
const manifestJson = JSON.parse(manifestRaw);

if (!isProdEnv && typeof manifestJson.name === "string") {
  const trimmedName = manifestJson.name.trim();
  if (!trimmedName.endsWith("(DEV)") && !trimmedName.includes(" (DEV)")) {
    manifestJson.name = `${trimmedName} (DEV)`;
  }
}

writeFileSync(stageManifestPath, `${JSON.stringify(manifestJson, null, 2)}\n`, "utf8");
cpSync(distDir, stageDistDir, { recursive: true });

console.log(
  `[package:figma] Creating plugin archive at ${relative(repoRoot, packagePath)}`
);

const zipArgs = ["-r", packagePath, "."];
const zipResult = spawnSync("zip", zipArgs, {
  cwd: stageDir,
  stdio: "inherit"
});

if (zipResult.error) {
  if (zipResult.error.code === "ENOENT") {
    console.error(
      "[package:figma] The `zip` command is not available on this system. Install zip or run inside an environment where it is accessible."
    );
  } else {
    console.error(`[package:figma] Failed to spawn zip: ${zipResult.error.message}`);
  }
  process.exit(1);
}

if (zipResult.status !== 0) {
  console.error(`[package:figma] zip exited with status ${zipResult.status ?? "unknown"}.`);
  process.exit(zipResult.status ?? 1);
}

console.log(
  `[package:figma] Archive ready: ${relative(repoRoot, packagePath)} (includes manifest.json and dist/)`
);

const baseName =
  packagePath.endsWith(".zip") && basename(packagePath).length > 4
    ? basename(packagePath, ".zip")
    : packageBaseName;

const unzippedDir =
  packageEnvPath && packageEnvPath.length > 0
    ? resolve(dirname(packagePath), baseName)
    : join(defaultSubmissionDir, baseName);

if (existsSync(unzippedDir)) {
  rmSync(unzippedDir, { recursive: true, force: true });
}
mkdirSync(dirname(unzippedDir), { recursive: true });
cpSync(stageDir, unzippedDir, { recursive: true });

console.log(
  `[package:figma] Unzipped submission copy ready at ${relative(
    repoRoot,
    unzippedDir
  )} (manifest.json + dist/)`
);

rmSync(stageDir, { recursive: true, force: true });

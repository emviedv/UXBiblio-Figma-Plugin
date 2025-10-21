#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const sourceDir = resolve(projectRoot, "dist", "ui");

if (!existsSync(sourceDir)) {
  console.warn(
    `[export-ui-bundle] Source directory not found at ${sourceDir}. Skipping artifact export.`
  );
  process.exit(0);
}

const targetEnv = process.env.RAILPACK_UI_EXPORT_DIR ?? "/dist/ui";
const targetDir = isAbsolute(targetEnv) ? targetEnv : resolve(projectRoot, targetEnv);
const isRootUser = typeof process.getuid === "function" ? process.getuid() === 0 : false;

if (isAbsolute(targetDir) && !isRootUser) {
  console.log(
    `[export-ui-bundle] Skipping copy to ${targetDir} because the current process lacks root access.`
  );
  process.exit(0);
}

try {
  if (targetDir === "/" || targetDir.trim() === "") {
    console.warn("[export-ui-bundle] Refusing to write to root directory. Skipping export.");
    process.exit(0);
  }

  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true });
  console.log(`[export-ui-bundle] Copied UI bundle to ${targetDir}`);
} catch (error) {
  console.warn(`[export-ui-bundle] Unable to copy UI bundle to ${targetDir}: ${error.message}`);
  process.exit(0);
}

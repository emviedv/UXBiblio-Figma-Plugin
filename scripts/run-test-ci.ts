/**
 * CI audit script that performs quick sanity checks before running heavier clone analysis.
 *
 * The checks here intentionally focus on repository wiring so the subsequent clone steps can
 * assume the project structure is intact. Any failure flips the exit code to non-zero so CI
 * pipelines can halt early.
 */
import { constants as fsConstants, createReadStream } from "node:fs";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

type CheckResult = {
  name: string;
  ok: boolean;
  details: string[];
  printOnSuccess?: boolean;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const REQUIRED_DIRECTORIES = ["src", "ui", "scripts", "tests", "docs"];
const REQUIRED_FILES = ["package.json", "tsconfig.json", "vitest.config.ts", "manifest.json", ".env.example"];
const REQUIRED_SCRIPTS = [
  "dev",
  "build",
  "lint",
  "test",
  "typecheck",
  "check",
  "test:clones:console",
  "check:clones",
  "test:ci"
];

const IGNORE_DIRS = new Set([".git", "node_modules", "dist", "coverage", "reports", ".turbo", ".next"]);
const LOC_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".scss",
  ".md"
]);

const results: CheckResult[] = [];

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function run(): Promise<void> {
  console.log("\n🔍 Running UXBiblio plugin CI audit...\n");

  await recordCheck("Repository layout", async () => {
    const missingEntries: string[] = [];
    for (const dir of REQUIRED_DIRECTORIES) {
      if (!(await pathExists(resolve(REPO_ROOT, dir)))) {
        missingEntries.push(`Missing directory: ${dir}`);
      }
    }

    for (const file of REQUIRED_FILES) {
      if (!(await pathExists(resolve(REPO_ROOT, file)))) {
        missingEntries.push(`Missing file: ${file}`);
      }
    }

    return missingEntries.length === 0
      ? withDetails(true, ["All expected directories and config files are present."])
      : withDetails(false, missingEntries);
  });

  const packageJsonPath = resolve(REPO_ROOT, "package.json");
  const pkgRaw = await safeRead(packageJsonPath);
  let pkgScripts: Record<string, string> = {};

  await recordCheck("Critical npm scripts", async () => {
    if (!pkgRaw.ok) {
      return withDetails(false, [`Unable to read package.json: ${pkgRaw.error}`]);
    }

    try {
      const pkg = JSON.parse(pkgRaw.value);
      pkgScripts = pkg.scripts ?? {};
      const missingScripts = REQUIRED_SCRIPTS.filter((script) => !(script in pkgScripts));

      return missingScripts.length === 0
        ? withDetails(true, ["Required npm scripts found."])
        : withDetails(false, missingScripts.map((script) => `Missing script: ${script}`));
    } catch (error) {
      return withDetails(false, [`Failed to parse package.json: ${(error as Error).message}`]);
    }
  });

  await recordCheck(".env.example guardrails", async () => {
    const envPath = resolve(REPO_ROOT, ".env.example");
    const envRaw = await safeRead(envPath);
    if (!envRaw.ok) {
      return withDetails(false, [`Unable to read .env.example: ${envRaw.error}`]);
    }

    const lines = envRaw.value.split(/\r?\n/);
    const requiredHints = ["OPENAI_API_KEY", "OPENAI_BASE_URL"];
    const missingHints = requiredHints.filter((key) => {
      const matcher = new RegExp(`^#?\\s*${key}=`, "i");
      return !lines.some((line) => matcher.test(line.trim()));
    });

    return missingHints.length === 0
      ? withDetails(true, ["Security-sensitive env hints are present."])
      : withDetails(false, missingHints.map((key) => `Missing ${key} hint in .env.example`));
  });

  await recordCheck("Client/server/shared sanity", async () => {
    const checks: string[] = [];

    const loggerPath = resolve(REPO_ROOT, "src", "utils", "logger.ts");
    if (!(await pathExists(loggerPath))) {
      checks.push("Expected debug logger (src/utils/logger.ts) is missing.");
    }

    const uiDir = resolve(REPO_ROOT, "ui", "src");
    if (!(await pathExists(uiDir))) {
      checks.push("UI source directory (ui/src) is missing.");
    }

    const serverDir = resolve(REPO_ROOT, "server");
    if (!(await pathExists(serverDir))) {
      checks.push("Server directory is missing (server/).");
    }

    return checks.length === 0
      ? withDetails(true, ["Client/UI/server scaffolding detected."])
      : withDetails(false, checks);
  });

  await recordCheck("Integration suite", async () => {
    if (!pkgScripts["test:integration"]) {
      return withDetails(false, ["package.json is missing a test:integration script."]);
    }

    const { exitCode, output } = await runCommand("npm", ["run", "test:integration"]);

    for (const line of output) {
      if (line.trim().length > 0) {
        console.log(`  ${line}`);
      }
    }

    return exitCode === 0
      ? withDetails(true, ["Characterization integration suite passed."])
      : withDetails(false, ["Integration suite failed. Check output above."]);
  });

  await recordCheck("Repository metrics", async () => {
    const metrics = await collectRepositoryMetrics();
    if (!metrics) {
      return withDetails(false, ["Unable to collect LOC stats."]);
    }

    const summary: string[] = [
      `Total tracked files: ${metrics.totalFiles}`,
      `Aggregate LOC (tracked extensions): ${metrics.totalLines}`
    ];

    summary.push("Top 20 largest files:");
    for (const { file, lines } of metrics.topFiles.slice(0, 20)) {
      summary.push(`  • ${file} — ${lines} lines`);
    }

    if (metrics.cloneSummary.length > 0) {
      summary.push("Recent clone families:");
      for (const clone of metrics.cloneSummary) {
        summary.push(`  • Tokens ${clone.tokens}: ${clone.files.join(" | ")}`);
      }
    } else {
      summary.push("No clone summary found yet. Run the clone checks to generate JSON results.");
    }

    return withDetails(true, summary, { printOnSuccess: true });
  });

  const failed = results.filter((result) => !result.ok);
  const passedCount = results.length - failed.length;

  console.log("\n🧾 Summary");
  console.log(`  ✔ Passed: ${passedCount}`);
  console.log(`  ✖ Failed: ${failed.length}`);

  for (const result of failed) {
    console.log(`\n❌ ${result.name}`);
    result.details.forEach((detail) => console.log(`   - ${detail}`));
  }

  if (failed.length === 0) {
    console.log("\n✅ CI audit completed without blocking issues.\n");
    process.exit(0);
  } else {
    console.error("\n🚨 CI audit detected failures.\n");
    process.exit(1);
  }
}

async function recordCheck(name: string, fn: () => Promise<CheckResult>): Promise<void> {
  process.stdout.write(`• ${name} ... `);
  try {
    const result = await fn();
    results.push({ name, ok: result.ok, details: result.details });
    console.log(result.ok ? "ok" : "failed");
    if (result.ok && result.printOnSuccess && result.details.length > 0) {
      logDetails(result.details);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, details: [message] });
    console.log("failed");
  }
}

function logDetails(details: string[]): void {
  for (const detail of details) {
    if (detail.trim().length === 0) {
      continue;
    }
    const prefix = detail.startsWith("  ") ? " " : "   ";
    console.log(`${prefix}${detail}`);
  }
}

function withDetails(ok: boolean, details: string[], options: { printOnSuccess?: boolean } = {}): CheckResult {
  return { name: "", ok, details, ...options };
}

type CommandResult = {
  exitCode: number;
  output: string[];
};

async function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolvePromise) => {
    const output: string[] = [];
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      env: { ...process.env, CI: "true" },
      stdio: ["ignore", "pipe", "pipe"]
    });

    const collect = (data: Buffer) => {
      output.push(...data.toString("utf8").split(/\r?\n/));
    };

    child.stdout.on("data", collect);
    child.stderr.on("data", collect);

    child.on("close", (code) => {
      resolvePromise({ exitCode: code ?? 1, output });
    });
  });
}

type RepoMetrics = {
  totalFiles: number;
  totalLines: number;
  topFiles: Array<{ file: string; lines: number }>;
  cloneSummary: Array<{ tokens: number; files: string[] }>;
};

async function collectRepositoryMetrics(): Promise<RepoMetrics | null> {
  const files: Array<{ path: string; lines: number }> = [];
  await walkDirectory(REPO_ROOT, files);

  const totalLines = files.reduce((sum, file) => sum + file.lines, 0);
  const topFiles = [...files].sort((a, b) => b.lines - a.lines).slice(0, 20);

  const cloneSummary = await readCloneSummary();

  return {
    totalFiles: files.length,
    totalLines,
    topFiles: topFiles.map((entry) => ({
      file: entry.path,
      lines: entry.lines
    })),
    cloneSummary
  };
}

async function walkDirectory(currentDir: string, files: Array<{ path: string; lines: number }>): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) {
      continue;
    }

    const entryPath = resolve(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walkDirectory(entryPath, files);
      continue;
    }

    const ext = getExtension(entry.name);
    if (!LOC_EXTENSIONS.has(ext)) {
      continue;
    }

    const lines = await countLines(entryPath);
    files.push({
      path: relative(REPO_ROOT, entryPath),
      lines
    });
  }
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) {
    return "";
  }
  return filename.slice(lastDot);
}

async function countLines(filePath: string): Promise<number> {
  const input = createReadStream(filePath, { encoding: "utf8" });
  const rl = createInterface({ input, crlfDelay: Infinity });

  let lines = 0;
  for await (const _ of rl) {
    lines += 1;
  }

  return lines;
}

async function readCloneSummary(): Promise<Array<{ tokens: number; files: string[] }>> {
  const reportPath = resolve(REPO_ROOT, "reports", "jscpd", "jscpd-report.json");
  if (!(await pathExists(reportPath))) {
    return [];
  }

  try {
    const raw = await readFile(reportPath, "utf8");
    const parsed = JSON.parse(raw) as {
      duplicates?: Array<{ firstFile: { name: string }; secondFile: { name: string }; tokens?: number }>;
    };

    if (!parsed.duplicates || parsed.duplicates.length === 0) {
      return [];
    }

    return parsed.duplicates.slice(0, 5).map((duplicate) => ({
      tokens: duplicate.tokens ?? 0,
      files: [duplicate.firstFile.name, duplicate.secondFile.name]
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to read clone summary: ${message}`);
    return [];
  }
}

type SafeReadResult =
  | { ok: true; value: string }
  | {
      ok: false;
      error: string;
    };

async function safeRead(pathname: string): Promise<SafeReadResult> {
  try {
    const value = await readFile(pathname, "utf8");
    return { ok: true, value };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

void run();

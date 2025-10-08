#!/usr/bin/env node

/**
 * Figma runtime compatibility check for built assets.
 *
 * Chrome 69 is the baseline engine for the Figma desktop runtime, so the
 * plugin bundle must avoid newer syntax such as optional chaining.
 */

const fs = require("node:fs");
const path = require("node:path");

const DIST_DIR = path.resolve(__dirname, "..", "dist");
const MAIN_BUNDLE = path.join(DIST_DIR, "main.js");

const PROBLEMATIC_PATTERNS = [
  {
    pattern: /\?\./g,
    name: "Optional chaining (?.)",
    description: "Optional chaining is not supported in Chrome 69 / Figma runtime.",
    severity: "error"
  },
  {
    pattern: /\?\?/g,
    name: "Nullish coalescing (??)",
    description: "Nullish coalescing is not supported in Chrome 69 / Figma runtime.",
    severity: "error"
  },
  {
    pattern: /#\w+/g,
    name: "Private class fields (#field)",
    description: "Private class fields require a newer JavaScript runtime.",
    severity: "error",
    validate(match, content, index) {
      // Ignore occurrences inside comments or strings to reduce noise.
      return !isInsideStringOrComment(content, index);
    }
  },
  {
    pattern: /\bBigInt\b/g,
    name: "BigInt usage",
    description: "BigInt is only partially supported in older Chromium builds.",
    severity: "warning"
  },
  {
    pattern: /(?<!['"`])\.\.\.(?!['"`])/g,
    name: "Spread operator (...)",
    description:
      "Spread operators can slip through if the bundler target is too high. Ensure downleveling to ES2018.",
    severity: "warning",
    validate(match, content, index) {
      return !isInsideStringOrComment(content, index);
    }
  },
  {
    pattern: /import\s*\(/g,
    name: "Dynamic import()",
    description: "Dynamic imports are not supported in the Figma plugin sandbox.",
    severity: "error"
  }
];

function isInsideStringOrComment(content, index) {
  const before = content.slice(0, index);
  const singleQuotes = (before.match(/'/g) || []).length;
  const doubleQuotes = (before.match(/"/g) || []).length;
  const backticks = (before.match(/`/g) || []).length;

  if (singleQuotes % 2 === 1 || doubleQuotes % 2 === 1 || backticks % 2 === 1) {
    return true;
  }

  const lastLineBreak = before.lastIndexOf("\n");
  const lineStart = lastLineBreak === -1 ? 0 : lastLineBreak + 1;
  const linePrefix = before.slice(lineStart);

  if (linePrefix.trimStart().startsWith("//")) {
    return true;
  }

  const blockCommentStart = before.lastIndexOf("/*");
  if (blockCommentStart !== -1) {
    const blockCommentEnd = before.lastIndexOf("*/");
    if (blockCommentEnd < blockCommentStart) {
      return true;
    }
  }

  return false;
}

function collectUiBundles() {
  const uiDir = path.join(DIST_DIR, "ui");
  const files = [];

  if (!fs.existsSync(uiDir)) {
    return files;
  }

  const stack = [uiDir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

function checkFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`WARNING: File not found -> ${path.relative(process.cwd(), filePath)}`);
    return { errors: 0, warnings: 0, issues: [] };
  }

  const content = fs.readFileSync(filePath, "utf8");
  const issues = [];
  let errors = 0;
  let warnings = 0;

  console.log(`\n🔍 Checking ${path.relative(process.cwd(), filePath)}...`);

  for (const pattern of PROBLEMATIC_PATTERNS) {
    const matches = [...content.matchAll(pattern.pattern)];
    for (const match of matches) {
      const index = match.index ?? 0;
      if (pattern.validate && !pattern.validate(match[0], content, index)) {
        continue;
      }

      const lineNumber = content.slice(0, index).split("\n").length;
      const severity = pattern.severity;
      if (severity === "error") {
        errors += 1;
      } else {
        warnings += 1;
      }

      issues.push({
        file: filePath,
        name: pattern.name,
        description: pattern.description,
        severity,
        match: match[0],
        line: lineNumber
      });

      const label = severity === "error" ? "ERROR" : "WARNING";
      console.log(`  ${label}: ${pattern.name} at line ${lineNumber}`);
      console.log(`     ${pattern.description}`);
      console.log(`     Match: "${match[0]}"`);
    }
  }

  if (!issues.length) {
    console.log("  No compatibility issues found.");
  }

  return { errors, warnings, issues };
}

function printSummary(results) {
  const totalFiles = results.length;
  const totalErrors = results.reduce((sum, item) => sum + item.errors, 0);
  const totalWarnings = results.reduce((sum, item) => sum + item.warnings, 0);

  console.log("\n📊 Summary");
  console.log("==========");
  console.log(`Files checked: ${totalFiles}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Total warnings: ${totalWarnings}`);

  if (totalErrors > 0) {
    console.log("\nCompatibility check failed. Resolve the errors above before shipping.");
    process.exit(1);
  }

  if (totalWarnings > 0) {
    console.log("\nWarnings detected. Review them to ensure Figma runtime support.");
  } else {
    console.log("\nAll compatibility checks passed.");
  }

  console.log("\n🔗 Figma runtime guidance: https://www.figma.com/plugin-docs/plugin-api-version/");
}

function main() {
  console.log("🔧 Figma Compatibility Checker");
  console.log("==============================");

  if (!fs.existsSync(DIST_DIR)) {
    console.error('dist/ directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  const targets = [MAIN_BUNDLE, ...collectUiBundles()];

  if (!targets.length) {
    console.warn("WARNING: No JavaScript bundles found to inspect.");
  }

  const results = targets.map(checkFile);
  printSummary(results);
}

if (require.main === module) {
  main();
}

module.exports = {
  checkFile,
  collectUiBundles,
  PROBLEMATIC_PATTERNS
};

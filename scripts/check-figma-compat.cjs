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
    // Match plausible JS private identifiers (skip numeric-start like #000000)
    pattern: /#[A-Za-z_$][A-Za-z0-9_$]*/g,
    name: "Private class fields (#field)",
    description: "Private class fields require a newer JavaScript runtime.",
    severity: "error",
    validate(match, content, index, insideMap) {
      // 1) Ignore when inside strings or comments (use precomputed map when provided)
      if (insideMap && isInsideIndex(insideMap, index)) return false;
      if (!insideMap && isInsideStringOrComment(content, index)) return false;

      // 2) Ignore CSS hex colors that include letters (e.g., #D75695)
      if (/^#[0-9A-Fa-f]{3,8}$/.test(match)) return false;

      return true;
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
    "Spread operators can slip through if the bundler target is too high. Ensure downleveling to ES2017.",
  severity: "warning",
  validate(match, content, index, insideMap, bracketContext) {
    if (isInsideIndex(insideMap, index)) return false;
    if (!bracketContext) return true;
    return bracketContext[index] === "{";
  }
},
  {
    pattern: /import\s*\(/g,
    name: "Dynamic import()",
    description: "Dynamic imports are not supported in the Figma plugin sandbox.",
    severity: "error"
  }
];

// Lightweight state scanner to identify positions inside strings or comments.
// Builds a boolean map for the entire file once per check.
function buildStringCommentMap(content) {
  const len = content.length;
  const inside = new Uint8Array(len); // 1 when inside string/comment/template text

  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let tplExprDepth = 0; // depth within ${ ... } in a template

  for (let i = 0; i < len; i += 1) {
    const c = content[i];
    const next = i + 1 < len ? content[i + 1] : "";

    if (inLineComment) {
      inside[i] = 1;
      if (c === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      inside[i] = 1;
      if (c === "*" && next === "/") {
        inside[i + 1] = 1;
        i += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (inSingle) {
      inside[i] = 1;
      if (c === "\\") {
        // escape next char
        if (i + 1 < len) {
          inside[i + 1] = 1;
          i += 1;
        }
        continue;
      }
      if (c === "'") inSingle = false;
      continue;
    }

    if (inDouble) {
      inside[i] = 1;
      if (c === "\\") {
        if (i + 1 < len) {
          inside[i + 1] = 1;
          i += 1;
        }
        continue;
      }
      if (c === '"') inDouble = false;
      continue;
    }

    if (inTemplate && tplExprDepth === 0) {
      // Template string literal text (not inside ${ ... })
      inside[i] = 1;
      if (c === "\\") {
        if (i + 1 < len) {
          inside[i + 1] = 1;
          i += 1;
        }
        continue;
      }
      if (c === "`") {
        inTemplate = false;
        continue;
      }
      if (c === "$" && next === "{") {
        // Enter expression; not inside string during the `${` token
        tplExprDepth = 1;
        i += 1; // skip '{'
        continue;
      }
      continue;
    }

    if (inTemplate && tplExprDepth > 0) {
      // Inside a template expression — treat as code
      if (c === "/" && next === "/") {
        inLineComment = true;
        continue;
      }
      if (c === "/" && next === "*") {
        inBlockComment = true;
        continue;
      }
      if (c === "'") {
        inSingle = true;
        inside[i] = 1;
        continue;
      }
      if (c === '"') {
        inDouble = true;
        inside[i] = 1;
        continue;
      }
      if (c === "`") {
        // Nested template inside expression; enter nested template literal text
        inTemplate = true;
        // We reuse tplExprDepth for the outer expression; nested templates can
        // themselves include expressions, but this is sufficient for our needs.
        inside[i] = 1;
        continue;
      }
      if (c === "{") {
        tplExprDepth += 1;
        continue;
      }
      if (c === "}") {
        tplExprDepth -= 1;
        continue;
      }
      continue;
    }

    // Top-level (not inside string/comment/template)
    if (c === "/" && next === "/") {
      inLineComment = true;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlockComment = true;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      inside[i] = 1;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      inside[i] = 1;
      continue;
    }
    if (c === "`") {
      inTemplate = true;
      inside[i] = 1;
      continue;
    }
  }

  return inside;
}

function isInsideIndex(insideMap, index) {
  return !!(insideMap && insideMap[index] === 1);
}

// Retain the older function for other validators; it is used as a fallback.
function isInsideStringOrComment(content, index) {
  const map = buildStringCommentMap(content);
  return isInsideIndex(map, index);
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
  const insideMap = buildStringCommentMap(content);
  const bracketContext = buildBracketContextMap(content, insideMap);
  const issues = [];
  let errors = 0;
  let warnings = 0;

  console.log(`\n🔍 Checking ${path.relative(process.cwd(), filePath)}...`);

  for (const pattern of PROBLEMATIC_PATTERNS) {
    const matches = [...content.matchAll(pattern.pattern)];
    for (const match of matches) {
      const index = match.index ?? 0;
      if (pattern.validate && !pattern.validate(match[0], content, index, insideMap, bracketContext)) {
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

function buildBracketContextMap(content, insideMap) {
  const len = content.length;
  const stack = [];
  const context = new Array(len);

  for (let i = 0; i < len; i += 1) {
    context[i] = stack.length ? stack[stack.length - 1] : null;
    if (insideMap && insideMap[i] === 1) {
      continue;
    }

    const char = content[i];
    if (char === "(" || char === "[" || char === "{") {
      stack.push(char);
      continue;
    }

    if (char === ")" || char === "]" || char === "}") {
      if (stack.length) {
        stack.pop();
      }
    }
  }

  return context;
}

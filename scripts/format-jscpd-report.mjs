#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

async function main() {
  const reportPath = process.argv[2];
  if (!reportPath) {
    console.error("Usage: node scripts/format-jscpd-report.mjs <reportPath>");
    process.exit(1);
  }

  try {
    const raw = await readFile(reportPath, "utf8");
    const data = JSON.parse(raw);
    const duplicates = data.duplicates ?? [];

    if (duplicates.length === 0) {
      console.log("✅ No clone families detected by jscpd.");
      return;
    }

    console.log(`🚨 jscpd detected ${duplicates.length} clone families (showing first 10):`);
    duplicates.slice(0, 10).forEach((duplicate, index) => {
      const tokens = duplicate.tokens ?? 0;
      const first = duplicate.firstFile?.name ? basename(duplicate.firstFile.name) : "unknown";
      const second = duplicate.secondFile?.name ? basename(duplicate.secondFile.name) : "unknown";
      console.log(
        `  ${index + 1}. Tokens: ${tokens.toString().padStart(4, " ")} | ${first} ↔ ${second}`
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to format jscpd report: ${message}`);
    process.exit(1);
  }
}

void main();

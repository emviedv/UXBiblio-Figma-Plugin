import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

const IMPORT_PATTERN = /@import\s+["']([^"']+)["'];/g;

export function readCssAggregate(entryPath: string, visited: Set<string> = new Set()): string {
  const absolutePath = resolve(process.cwd(), entryPath);

  if (visited.has(absolutePath)) {
    return "";
  }

  visited.add(absolutePath);

  let css = readFileSync(absolutePath, "utf8");
  const importMatches = [...css.matchAll(IMPORT_PATTERN)];

  if (importMatches.length === 0) {
    return css;
  }

  let inlinedCss = css;

  for (const match of importMatches) {
    const [, importPath] = match;
    if (!importPath) continue;

    const importAbsolutePath = resolve(dirname(absolutePath), importPath);
    const importedCss = readCssAggregate(importAbsolutePath, visited);
    inlinedCss = inlinedCss.replace(match[0], importedCss);
  }

  return inlinedCss;
}

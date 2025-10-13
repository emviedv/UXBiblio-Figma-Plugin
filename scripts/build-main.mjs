#!/usr/bin/env node

import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const distDir = resolve(projectRoot, "dist");
const uiDir = resolve(distDir, "ui");
const uiHtmlPath = resolve(uiDir, "index.html");
const defaultBaseUrl =
  process.env.NODE_ENV === "production" ? "https://api.uxbiblio.com" : "http://localhost:4292";
const envAnalysisBase = process.env.UXBIBLIO_ANALYSIS_URL
  ? process.env.UXBIBLIO_ANALYSIS_URL.trim()
  : "";
const analysisBaseUrl = envAnalysisBase.length > 0 ? envAnalysisBase : defaultBaseUrl;
const debugLogsSetting = process.env.UXBIBLIO_DEBUG_LOGS ?? "true";
const enableDebugLogs = /^true$/i.test(debugLogsSetting);

console.log("[build-main] Analysis base URL:", analysisBaseUrl);

mkdirSync(distDir, { recursive: true });

let inlineUiHtml = "";

try {
  const rawHtml = readFileSync(uiHtmlPath, "utf8");
  inlineUiHtml = inlineUiAssets(rawHtml);
} catch (error) {
  console.warn(
    "[build-main] Could not read UI bundle at dist/ui/index.html. " +
      "Run `npm run build:ui` first to embed the latest UI."
  );
}

await build({
  entryPoints: [resolve(projectRoot, "src", "main.ts")],
  bundle: true,
  outfile: resolve(distDir, "main.js"),
  format: "iife",
  platform: "browser",
  target: ["es2017"],
  supported: {
    "nullish-coalescing": false,
    "object-rest-spread": false
  },
  sourcemap: true,
  define: {
    __UI_HTML__: JSON.stringify(inlineUiHtml),
    __ANALYSIS_BASE_URL__: JSON.stringify(analysisBaseUrl),
    __DEBUG_LOGGING__: JSON.stringify(enableDebugLogs)
  }
});

console.log("[build-main] Built dist/main.js");

function inlineUiAssets(html) {
  let transformed = html;

  transformed = transformed.replace(
    /<link\s+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
    (match, href) => {
      const assetPath = resolveAssetPath(href);
      try {
        const css = readFileSync(assetPath, "utf8");
        return `<style>${css}</style>`;
      } catch (error) {
        console.warn(`[build-main] Failed to inline stylesheet at ${href}:`, error);
        return match;
      }
    }
  );

  transformed = transformed.replace(
    /<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
    (match, src) => {
      const assetPath = resolveAssetPath(src);
      try {
        const js = readFileSync(assetPath, "utf8").replace(/<\/script>/gi, "<\\/script>");
        return `<script type="module">${js}</script>`;
      } catch (error) {
        console.warn(`[build-main] Failed to inline module script at ${src}:`, error);
        return match;
      }
    }
  );

  return transformed;
}

function resolveAssetPath(relativePath) {
  const cleaned = relativePath.replace(/^\.?\//, "");
  return resolve(uiDir, cleaned);
}

# Agent Guide — UXBiblio Figma Plugin

This repository houses the Figma plugin implementation for UXBiblio. Keep this file updated with product context, workflows, and coordination details relevant to the plugin.

---

## Key Docs

- [MVP PRD — UXBiblio Figma Plugin (v0.1)](docs/UXBiblio-Figma-Plugin-MVP-PRD.md)
- Main product folder: `/Users/emily/Products/UXBiblio`

## Guardrails
- No hallucinated dependencies.
- No speculative architecture.
- Never overwrite AGENTS.md.
- Never modify repo config unless requested.
- Always reference the repo folder as `/Users/emily/Products/UXBiblio Figma-Plugin` when documenting or coordinating changes.
- Do not edit files belonging to other UXBiblio products or repositories.
- Never revert new code without confirming with Emily first; parallel chats may introduce fresh changes.
- Default development requests to staging/local AI endpoints by setting `UXBIBLIO_ANALYSIS_URL`; use production only for intentional final verification to avoid analytics noise.

## UX & Design Standards
- Do not pre-add UI placeholders; discuss with the team before introducing new visible elements unless explicitly requested.
- Use UX writing best practices.
- Component names should be descriptive (`AnalyzeButton`, `ResultsPanel`, etc.).

## Debug Logging
- `src/utils/logger.ts` exposes a toggleable logger used throughout the plugin runtime.
- Debug logs default to **on** for local builds. Disable by running `UXBIBLIO_DEBUG_LOGS=false npm run build`.
- When asking for diagnostics, prefer `logger.debug/info/warn/error` instead of raw `console.*`.

## Flows
### test:ci Flow
- `ts-node-esm scripts/run-test-ci.ts`: runs the TypeScript CI audit that verifies key directories/configs, ensures critical npm scripts (including `test:integration`, `test:clones:console`, and `check:clones`) exist, sanity-checks plugin/server scaffolding, confirms `.env.example` guardrails, kicks off the characterization-focused Vitest integration suite (`npm run test:integration`), and emits a pass/fail summary with LOC totals, the 20 largest tracked files, and recent clone highlights if `reports/jscpd/jscpd-report.json` is present. (scripts/run-test-ci.ts)
- `npm run test:clones:console`: invokes `scripts/test-clones-console.sh`, which runs jscpd in strict mode with the console reporter and extensive ignore rules. It always exits successfully so CI can keep moving while still surfacing duplicate snapshots. (scripts/test-clones-console.sh)
- `npm run check:clones`: executes `scripts/check-clones.sh`, running jscpd again with the JSON reporter to populate `reports/jscpd/jscpd-report.json`, formatting the output via `scripts/format-jscpd-report.mjs`, and propagating jscpd’s exit status so CI fails when clone thresholds are exceeded. (scripts/check-clones.sh, scripts/format-jscpd-report.mjs)

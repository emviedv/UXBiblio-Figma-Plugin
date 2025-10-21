# UXBiblio Figma Plugin

Starter scaffolding for the UXBiblio – AI-Powered UX Analysis & Heuristic Evaluator plugin MVP v0.1. The plugin delivers in-context UX analysis for a selected Figma frame without requiring authentication.

## Getting Started

1. Install dependencies: `npm install`
2. Run the UI locally during development: `npm run dev`
3. Build distributable assets (main bundle + UI): `npm run build`
4. Run static analysis checks (lint + typecheck + tests): `npm run check`

## Scripts

- `npm run dev` — Start the Vite dev server for the plugin UI.
- `npm run lint` — Lint TypeScript and React sources in `src/` and `ui/src/`.
- `npm run format` — Verify Prettier formatting across the project.
- `npm run test` — Execute Vitest in run mode (Node environment). (Note: tests cannot run in the CLI sandbox; execute locally.)
- `npm run typecheck` — Run TypeScript compiler without emitting files.
- `npm run check` — Aggregate lint, typecheck, and test runs for quick validation.
- `npm run test:ci` — Wires together three checks so CI can gate on repo health in one command:
  - Runs `ts-node-esm scripts/run-test-ci.ts` to execute the TypeScript-based CI audit. The audit validates repo layout/config files, confirms critical npm scripts (including `test:integration`, `test:clones:console`, and `check:clones`), sanity-checks plugin/server scaffolding, verifies `.env.example` hints, triggers the characterization-focused Vitest integration suite (`npm run test:integration`), and prints a summarized pass/fail report with LOC totals, the 20 largest tracked files, and the latest clone highlights when `reports/jscpd/jscpd-report.json` is present.
  - Calls `bash scripts/test-clones-console.sh` to run jscpd with the console reporter for a quick, colorized duplicate-code snapshot (non-blocking so the pipeline continues even when clones appear).
  - Finishes with `bash scripts/check-clones.sh`, rerunning jscpd in JSON mode to populate `reports/jscpd/jscpd-report.json`, formatting results through `scripts/format-jscpd-report.mjs`, and propagating jscpd's exit status so CI fails when clone thresholds are exceeded.
  - Simplified: the command runs the TypeScript "CI audit" script, then two jscpd passes (console + JSON) to cover repo sanity checks, characterization tests, and clone thresholds in one go.

The build pipeline outputs the compiled plugin to the `dist/` directory. The manifest references `dist/main.js` and `dist/ui/index.html`, so keep those paths intact when packaging the plugin for Figma.

## Configuration

- Set `UXBIBLIO_ANALYSIS_URL` before running `npm run build` to point at a different API base. When `NODE_ENV` is not `production`, the build now defaults to the local proxy at `http://localhost:4292` to prevent accidental production traffic.
- Copy `.env.example` to `.env.local` and populate `OPENAI_API_KEY` (and optionally `OPENAI_BASE_URL`/`OPENAI_MODEL`) so the local analysis proxy can authenticate without exporting environment variables each run.
- The UI bundle must be generated (`npm run build:ui`) before the main bundle so that the UI HTML can be embedded. The combined `npm run build` script handles this ordering.

## Project Structure

- `src/main.ts` — Figma plugin controller (selection handling, API calls, color extraction).
- `ui/src/*.tsx` — React UI rendered inside the plugin iframe.
- `ui/index.html` — Entry point for the Vite-powered UI.
- `scripts/build-main.mjs` — Custom esbuild wrapper that embeds the compiled UI HTML into `main.js`.
- `manifest.json` — Figma plugin manifest (v3).

## Next Steps

- Wire the analysis response shape to match the production API contract once available.
- Add tests (unit or integration) around selection export, color extraction, and UI state transitions.
- Integrate telemetry/analytics hooks when ready.

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
- Do not strip shared card dividers, borders, or other established visual chrome without clearing the change with Emily.
- Default development requests to staging/local AI endpoints by setting `UXBIBLIO_ANALYSIS_URL`; use production only for intentional final verification to avoid analytics noise.
 - Build output baseline: ES2017. Bundle targets for main and UI must be `es2017`; the compatibility checker enforces ES2017-level syntax in built assets.
- Call out explicitly whenever a restart (`npm run dev`, `npm run server`) or fresh build is required to pick up code changes so the team knows when the running plugin bundle is stale.

## UX & Design Standards
- Do not pre-add UI placeholders; discuss with the team before introducing new visible elements unless explicitly requested.
- Use UX writing best practices.
- Component names should be descriptive (`AnalyzeButton`, `ResultsPanel`, etc.).
- Empty and skeleton states must surface the Frame icon (import `Frame` from `lucide-react` for consistency across notices).

### Analysis Tabs Behavior
- During analyzing/cancelling, tab switching remains enabled. If a section is incomplete, the active panel renders a non-blocking skeleton placeholder (accessible: `role="status"`, `aria-busy="true"`, `data-skeleton="true"`). Summary surfaces `uxSignals` once analysis completes; no dedicated Color Palette tab in the current UI.

### Global Progress Indicator
- While analyzing, each skeleton section shows a unified progress bar with a minutes-left callout. The progress bar is accessible (`role="progressbar"` with `aria-valuenow` when determinate) and appears only during analysis states.
- ETA is computed locally using a median of recent successful analysis durations stored in `localStorage` (last 10). No network polling or new dependencies. If no history exists yet, the indicator runs in indeterminate mode and omits the minutes-left label.
- Implementation surface: `ui/src/App.tsx` (progress state + history), `ui/src/components/layout/AnalysisTabsLayout.tsx` (renders progress inside skeleton), and `ui/src/styles.css` (styles under `.global-progress*`).

## Debug Logging
- `src/utils/logger.ts` exposes a toggleable logger used throughout the plugin runtime.
- Debug logs default to **on** for local builds. Disable by running `UXBIBLIO_DEBUG_LOGS=false npm run build`.
- When asking for diagnostics, prefer `logger.debug/info/warn/error` instead of raw `console.*`.

### Normalization Delta Diagnostics
- Added structured, removable debug logs that compare raw analysis payloads with normalized UI data to help parity checks with the Chrome extension.
- Location: `ui/src/utils/analysis.ts` emits a single `[AnalysisNormalizer][Delta]` entry per normalization with counts for raw vs structured sections, unknown keys, and presence flags.
- Additional drops are logged from:
  - `ui/src/utils/analysis/heuristics.ts` when a heuristic candidate is dropped for lacking both title and description.
  - `ui/src/utils/analysis/recommendations.ts` when bracketed metadata blocks (e.g., `Refs:`) are stripped during sanitization.
- All logs are gated by the shared logger and are easy to disable via `UXBIBLIO_DEBUG_LOGS=false`.

### Debug Log Policy
- Every bug discovered and every fix applied must be recorded in a product debug log. Include: date/time, concise summary, root cause, changed files/commits, and verification steps. Prefer `docs/live-debug/LIVE_DEBUG_YYYY-MM.md` (or `docs/debug-log.md` if no monthly log exists).

## Rule Codification & Conversation Clarity
- When Emily notes that something “should have been done” a certain way, capture that guidance here as a concise rule (add a brief example when useful).
- When applying a specific rule from this file, explicitly mention it in the conversation for clarity (e.g., “Applying Debug Log Policy” or “Following Commit Guidelines”).

- Do not render normalization metadata lines in tab content. Suppress labels like `Stage:` and `Guardrail:` in Psychology/Behavioral/Impact sections; show meaningful summary, signals, and next steps only. Example: Psychology card shows “Curiosity Gap — Intentional” with summary; omit “Stage: onboarding” and “Guardrail: …”.

- Recommendations Meta Chips (2025‑10‑16): Each recommendation must include Impact, Effort, and Refs metadata. Render these as chips (badges) adjacent to the recommendation text; do not expose colonized tokens in body copy (e.g., display `Impact High`, `Effort Low`, and `Refs heuristics[1], WCAG 1.4.3`, not `impact:high`/`Refs:` inline). If any block is missing, log a debug-only notice; do not auto-insert placeholders into the UI.

## AGENTS.md Maintenance
- Whenever you add new scripts, rules, ports, processes, or policies, update this AGENTS.md in the same change with a brief note and example if helpful.

## Flows
### test:ci Flow
- `ts-node-esm scripts/run-test-ci.ts`: runs the TypeScript CI audit that verifies key directories/configs, ensures critical npm scripts (including `test:integration`, `test:clones:console`, and `check:clones`) exist, sanity-checks plugin/server scaffolding, confirms `.env.example` guardrails, kicks off the characterization-focused Vitest integration suite (`npm run test:integration`), and emits a pass/fail summary with LOC totals, the 20 largest tracked files, and recent clone highlights if `reports/jscpd/jscpd-report.json` is present. (scripts/run-test-ci.ts)
- `npm run test:clones:console`: invokes `scripts/test-clones-console.sh`, which runs jscpd in strict mode with the console reporter and extensive ignore rules. It always exits successfully so CI can keep moving while still surfacing duplicate snapshots. (scripts/test-clones-console.sh)
- `npm run check:clones`: executes `scripts/check-clones.sh`, running jscpd again with the JSON reporter to populate `reports/jscpd/jscpd-report.json`, formatting the output via `scripts/format-jscpd-report.mjs`, and propagating jscpd’s exit status so CI fails when clone thresholds are exceeded. Default threshold is 4% (override with `CLONE_THRESHOLD`). (scripts/check-clones.sh, scripts/format-jscpd-report.mjs)
- `clones.config.json`: central ignore list for clone scanning; excludes tests, CSS, dist, coverage, and reports. The shell scripts automatically pass this config to jscpd when present.

## Assistant Notes
- Codex responses should stay structured and easy to scan (clear bullets, typography for key values, minimal fluff).
- Use the “Corner Radius / Spacing / Type Scale / Titles & Labels / Badges & Microcopy” breakout with bullet lists when documenting UI tokens, mirroring the formatting shared on 2025-03-09.

## Local Dev Ports
- Preserve port `3115`: the `kill:server` script must not terminate processes bound to `3115`. This prevents disrupting external/local tooling that relies on that port during plugin development. Example: running `npm run server` or `npm run dev` will no longer attempt to kill `3115`.

## Server TLS
- The local analysis server supports HTTPS when both `UXBIBLIO_TLS_KEY_PATH` and `UXBIBLIO_TLS_CERT_PATH` point to readable key/cert files. When set, the server listens on `https://localhost:<PORT>`.
- If these variables are not set (or files are missing), the server falls back to HTTP for local development and logs a startup warning. Prefer enabling TLS when verifying security requirements.

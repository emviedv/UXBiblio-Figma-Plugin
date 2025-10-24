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

### Flow Analysis
- The plugin supports analyzing up to **five** exportable frames or groups in a single run. Selections above the cap surface a warning and disable the Analyze action until trimmed.
- Free-tier accounts spend one credit **per frame** during a multi-frame analysis. Credits are decremented only after a successful response.
- The Analyze button copy reflects multi-frame context (e.g., `Analyze Flow (3)`), while limit/credit warnings are surfaced through the status banner and button tooltip.

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

- Ensure analysis formatting stays consistent and scannable; align sections to use lists or structured bullets so findings remain clear and actionable.

- UX Summary must not show scope notes. Present findings and signals only (example: display “Key friction: handoff gaps” and omit any `Scope: onboarding` line).

- Do not render normalization metadata lines in tab content. Suppress labels like `Stage:` and `Guardrail:` in Psychology/Behavioral/Impact sections; show meaningful summary, signals, and next steps only. Example: Psychology card shows “Curiosity Gap — Intentional” with summary; omit “Stage: onboarding” and “Guardrail: …”.

## Long-Term Viability Check
- Identify and flag any proposal that favors short-term gains over durable UX, maintainability, or strategic alignment. Document the risk and propose a resilient alternative before implementation.

- Recommendations Meta Chips (2025‑10‑16): Each recommendation must include Impact, Effort, and Refs metadata. Render these as chips (badges) adjacent to the recommendation text; do not expose colonized tokens in body copy (e.g., display `Impact High`, `Effort Low`, and `Refs heuristics[1], WCAG 1.4.3`, not `impact:high`/`Refs:` inline). If any block is missing, log a debug-only notice; do not auto-insert placeholders into the UI.

## 🧩 Root Cause Analysis Protocol

🧩 **Root Cause Analysis Protocol**

**Objective:** Find the *root cause* (not symptom). Verify all assumptions from the codebase before asking questions.  

---

### 🔍 1. Root Cause Procedure (STRICT)
1. Examine the **codebase** and related logs before asking questions.  
2. **Form 3 hypotheses** explaining why it fails.  
3. Validate each hypothesis with code evidence (tests, trace, logs).  
4. Repeat analysis until the *root cause* is verified, not just correlated.  
5. Include edge cases, unusual data flows, and concurrency paths.  
6. For each possibility, add:
   - 🔸 **Files touched**
   - ⚠️ **Risks of change**
   - ✅ Label which one **IS** the root cause or **most likely**.

**Rule:** Neither assume nor presume — **VERIFY and VALIDATE**.  
If multiple validated assumptions exist, find the *root one* or fix all related contributors.  

---

### 🧪 2. Debugging Requirements (STRICT)
- Add **detailed debugging** statements or structured logging where validation fails.  
- Use a dedicated logger or toggleable flag so these can be removed or disabled later.  
- Do **not** implement a fix yet — analysis only.  
- You may **run tests** after validation to confirm findings.  
- If new edge-case bugs are discovered, **identify and document them** for later fixes.  
- After any change to debugging setup:
  - Restart the server (if applicable)  
  - Re-run dev build (if applicable)

---

### ✅ Deliverables
- Three hypotheses, validated or disproven.  
- Edge cases and risks explicitly listed.  
- One labeled root cause.  
- File paths involved.  
- Optional: supporting logs, test evidence, or console output.

---

**STRICT MODE SUMMARY**  
☑ Code examined before questioning  
☑ 3 validated hypotheses  
☑ Edge cases considered  
☑ Root cause labeled  
☑ Debug logging added  
☑ Tests rerun post-validation  
☑ Server/dev build restarted if applicable

## AGENTS.md Maintenance
- Whenever you add new scripts, rules, ports, processes, or policies, update this AGENTS.md in the same change with a brief note and example if helpful.

## Flows
### test:ci Flow
- `ts-node-esm scripts/run-test-ci.ts`: runs the TypeScript CI audit that verifies key directories/configs, ensures critical npm scripts (including `test:integration`, `test:clones:console`, and `check:clones`) exist, sanity-checks plugin/server scaffolding, confirms `.env.example` guardrails, kicks off the characterization-focused Vitest integration suite (`npm run test:integration`), and emits a pass/fail summary with LOC totals, the 20 largest tracked files, and recent clone highlights if `reports/jscpd/jscpd-report.json` is present. (scripts/run-test-ci.ts)
- `npm run test:clones:console`: invokes `scripts/test-clones-console.sh`, which runs jscpd in strict mode with the console reporter and extensive ignore rules. It always exits successfully so CI can keep moving while still surfacing duplicate snapshots. (scripts/test-clones-console.sh)
- `npm run check:clones`: executes `scripts/check-clones.sh`, running jscpd again with the JSON reporter to populate `reports/jscpd/jscpd-report.json`, formatting the output via `scripts/format-jscpd-report.mjs`, and propagating jscpd’s exit status so CI fails when clone thresholds are exceeded. Default threshold is 4% (override with `CLONE_THRESHOLD`). (scripts/check-clones.sh, scripts/format-jscpd-report.mjs)
- `clones.config.json`: central ignore list for clone scanning; excludes tests, CSS, dist, coverage, and reports. The shell scripts automatically pass this config to jscpd when present.
- `scripts/export-ui-bundle.mjs`: after UI/main builds complete, copies `dist/ui` into `/dist/ui` (or `RAILPACK_UI_EXPORT_DIR`) so Railway builds can collect the bundle from the expected absolute path. Fails softly when the copy target is unavailable.

### package:figma Flow
- `npm run package:figma`: runs a fresh build, stages artifacts under `submission/<env>/` (default `submission/prod/`), and outputs both a zip (`uxbiblio-figma-plugin.zip`) and an expanded folder for side-loading. Non-production bundles auto-suffix `-DEV` in archive/folder names and append `(DEV)` to the manifest `name` so the plugin title reads correctly in Figma menus. Switch environments with `UXBIBLIO_FIGMA_PACKAGE_ENV=dev` and override the archive path with `UXBIBLIO_FIGMA_PACKAGE_PATH=/custom/path/plugin.zip` as needed. (scripts/package-figma-plugin.mjs)

## Assistant Notes
- Codex responses should stay structured and easy to scan (clear bullets, typography for key values, minimal fluff).
- Use the “Corner Radius / Spacing / Type Scale / Titles & Labels / Badges & Microcopy” breakout with bullet lists when documenting UI tokens, mirroring the formatting shared on 2025-03-09.

## Local Dev Ports
- Preserve port `3115`: the `kill:server` script must not terminate processes bound to `3115`. This prevents disrupting external/local tooling that relies on that port during plugin development. Example: running `npm run server` or `npm run dev` will no longer attempt to kill `3115`.
- Port `4292` runs the Figma analysis proxy (`npm run server`). Start it whenever the plugin must forward traffic to a UXBiblio backend that enforces CSRF so requests originate from Node instead of the Figma webview.

## Server TLS
- The local analysis server supports HTTPS when both `UXBIBLIO_TLS_KEY_PATH` and `UXBIBLIO_TLS_CERT_PATH` point to readable key/cert files. When set, the server listens on `https://localhost:<PORT>`.
- If these variables are not set (or files are missing), the server falls back to HTTP for local development and logs a startup warning. Prefer enabling TLS when verifying security requirements.

## Analysis Proxy Bridge
- Default the plugin to `UXBIBLIO_ANALYSIS_URL=http://localhost:4292` so analyses route through the local proxy.
- Provide `UXBIBLIO_ANALYSIS_UPSTREAM_URL` (e.g., `http://localhost:4111`) when you need the proxy to forward requests to a UXBiblio instance that performs CSRF checks—this keeps the Origin header out of browser requests and prevents `CSRF_ORIGIN_DENIED`.

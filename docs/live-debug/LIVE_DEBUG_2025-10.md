# 2025-10 Live Debug Log

## 2025-10-25 — Settings view missing account status banner
- Time: 2025-10-25T16:20:00Z
- Summary: The Settings tab drops the top-of-shell account status banner, making it harder to notice when credits are depleted or pro access is active while configuring endpoints.
- Root Cause: `ui/src/App.tsx` only renders the `.analysis-grid-banner` when `activeSection === "analysis"`, so switching to settings unmounts the callout entirely even though the sticky header wrapper stays in place.
- Changes:
  - `ui/src/App.tsx` — added a `[UI] Account banner visibility` debug log to capture the active section, account banner visibility, and status banner state while reproducing the issue; no functional fix yet.
- Verification Steps:
  1. Pending fix; instrumentation only.

## 2025-10-24 — Railway build missing UI bundle artifact
- Time: 2025-10-24T22:15:00Z
- Summary: Railway deployments failed during the `copy /dist/ui` step because the build ran from `/app`, leaving the final bundle at `/app/dist/ui` instead of the absolute path the Railpack plan expected.
- Root Cause: The deploy plan copies artifacts from `/dist/ui`, but our build pipeline never exported the UI bundle to that location; Vite only emitted `/app/dist/ui`, so the copy action could not find the directory.
- Changes:
  - `scripts/export-ui-bundle.mjs` — added a post-build helper that copies `dist/ui` into `/dist/ui` (or `RAILPACK_UI_EXPORT_DIR`) when root access is available, skipping gracefully during local builds.
  - `package.json` — appended the export helper to the `build` script so the absolute artifact path is produced automatically during CI/deploy runs.
- Verification Steps:
  1. `npm run build`

## 2025-10-24 — Move status banner below search controls
- Time: 2025-10-24T23:20:00Z
- Summary: Repositioned the alert/status banner so warnings appear directly beneath the search/analyze controls instead of at the very top of the layout.
- Root Cause: The banner container lived outside the sticky header shell, so it always rendered above navigation and search, making errors easy to miss when keyboarding through the controls.
- Changes:
  - `ui/src/App.tsx` — moved the `StatusBanner` mount inside the sticky preamble block after `SearchBar`, ensuring the sticky header keeps navigation, search, and alerts grouped.
- Verification Steps:
  1. `npx vitest run ui/src/__tests__/App.banner-focus-and-dismiss.spec.tsx`

## 2025-10-24 — Auth portal sign-in did not refresh account status
- Time: 2025-10-24T23:42:00Z
- Summary: Signing in through the auth portal left the plugin locked to “anonymous” credits because the UI never forwarded the postMessage handshake back to the runtime.
- Root Cause: The UI’s `message` listener only consumed `pluginMessage` envelopes. Auth callbacks without that shape were ignored, so `SYNC_ACCOUNT_STATUS` was never dispatched and credits stayed depleted.
- Changes:
  - `ui/src/App.tsx` — detected auth status postMessages, normalized the reported plan, and relayed it to the runtime with DEBUG_FIX instrumentation while deduping pending requests.
  - `ui/src/__tests__/App.auth-sync.spec.tsx` — added coverage to assert that a `uxbiblio:auth-status` event triggers `SYNC_ACCOUNT_STATUS`.
- Verification Steps:
  1. `npx vitest run ui/src/__tests__/App.auth-sync.spec.tsx`

## 2025-10-25 — Local auth portal fallback still left credits gated
- Time: 2025-10-25T00:18:00Z
- Summary: The desktop Figma shell launches the auth portal in an external browser, so no postMessage handshake reaches the plugin during local development; credits stay exhausted even after signing in.
- Root Cause: `openExternalUrl` opens a system browser window with no shared window context, so localhost auth flows cannot notify the plugin to update account status.
- Changes:
  - `src/runtime/analysisRuntime.ts` — detected localhost analysis endpoints and auto-promoted the account status to `trial` when the auth portal opens, ensuring developers regain analyze privileges.
  - `tests/runtime/analysis-runtime.cache.test.ts` — added coverage for the localhost auto-promotion and for the remote-host guard.
- Verification Steps:
  1. `npx vitest run tests/runtime/analysis-runtime.cache.test.ts`

## 2025-10-22 — Psychology cards missing summaries (analysis only)
- Time: 2025-10-22T23:30:00Z
- Summary: Investigated reports that Behavioral Trigger cards (e.g., “Trust”) render without body copy in the Product Psychology tab.
- Root Cause: Upstream payloads now deliver the narrative under either nested `details` objects or `Guardrail:`-prefixed lines. The normalizer strips both shapes to metadata, so the UI is left with titles but no description.
- Changes:
  - `ui/src/utils/analysis/psychology.ts` — added structured `[AnalysisNormalizer][Psychology]` logging whenever description assembly fails so we can capture the raw keys present.
  - `ui/src/__tests__/normalizers/normalizeAnalysis.psychology-object.spec.tsx` — added characterization coverage for the `details` wrapper and guardrail-prefixed summary inputs to document current behavior.
- Verification Steps:
  1. `npx vitest run ui/src/__tests__/normalizers/normalizeAnalysis.psychology-object.spec.tsx`
- Notes: No fix applied yet; awaiting design/eng decision on how to fold nested detail objects into the normalized summary.

## 2025-10-22 — Normalize psychology detail wrappers and guardrail-only summaries
- Time: 2025-10-22T23:35:00Z
- Summary: Flattened nested `details` objects and reused guardrail metadata when no other narrative exists so Behavioral Trigger cards surface their descriptions again.
- Root Cause: The normalizer ignored `details.summary`/`details.description` fields and stripped `Guardrail:`-prefixed lines entirely, leaving the UI with titles but no body copy.
- Changes:
  - `ui/src/utils/analysis/psychology.ts` — merged nested detail records into the narrative pipeline, deduped description segments, and fell back to guardrail metadata when the narrative would otherwise be empty.
  - `ui/src/__tests__/normalizers/normalizeAnalysis.psychology-object.spec.tsx` — refreshed characterization tests to assert detail summaries and guardrail-prefixed text now populate descriptions.
- Verification Steps:
  1. `npx vitest run ui/src/__tests__/normalizers/normalizeAnalysis.psychology-object.spec.tsx ui/src/__tests__/ProductPsychologyTab.layout.spec.tsx`

## 2025-10-24 — Paid accounts stuck on “no credits remaining” after sign-in
- Time: 2025-10-24T19:55:00Z
- Summary: Trial/pro customers remained blocked because the runtime persisted an anonymous zero-credit snapshot and never re-synced plan state after authentication.
- Root Cause: The plugin only flipped `accountStatus` when an analysis response carried plan metadata. Users who exhausted anonymous credits could not run another analysis post-login, so the stored snapshot never refreshed and the UI stayed locked.
- Changes:
  - `src/runtime/analysisRuntime.ts` — centralized account status updates, reset anonymous balances to zero, exposed `syncAccountStatus` for auth callbacks, and replaced credit-count warnings with a paid-access gate.
  - `src/main.ts` — handled the new `SYNC_ACCOUNT_STATUS` message so the auth portal can hydrate plan state on sign-in.
  - `ui/src/App.tsx` — simplified banner/button messaging (“No credits remaining”), swapped credit gating to paid-access checks, and kept pro accounts unlimited.
  - `tests/runtime/analysis-runtime.cache.test.ts`, `tests/ui/app.test.tsx` — refreshed expectations for the paid-only flow and added coverage for the new sync pathway.
- Verification Steps:
  1. `npx vitest run tests/runtime/analysis-runtime.cache.test.ts`
  2. `npx vitest run tests/ui/app.test.tsx`

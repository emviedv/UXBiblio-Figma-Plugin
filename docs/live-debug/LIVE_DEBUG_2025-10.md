# 2025-10 Live Debug Log

## 2025-10-26 — Sticky sidebar forced reflow diagnostics (analysis only)
- Time: 2025-10-26T09:30:00Z
- Summary: Investigating repeated “[Violation] Forced reflow while executing JavaScript” warnings and sluggish `message` handlers when the plugin posts selection updates.
- Root Cause: Pending. Added instrumentation to capture how often the sticky sidebar hook recalculates layout and how long panel metrics reads block the main thread so we can pinpoint the offending loop.
- Changes:
  - `ui/src/components/layout/hooks/useStickySidebarMetrics.ts` — recorded trigger source, duration, and skip counts for each sticky measurement cycle and elevated slow reads to warn-level logs.
  - `ui/src/components/layout/utils/logStickyMetrics.ts` — expanded the debug payload with trigger origin and timing data.
  - `ui/src/components/layout/utils/panelMetricsSummary.ts` — timed computed-style and bounding-rect reads to surface expensive panel snapshots.
  - `ui/src/components/layout/hooks/useAnalysisPanelDiagnostics.ts` — emitted warn-level alerts when panel metrics sampling exceeds 12 ms so slow paths are visible in DevTools.
- Verification Steps:
  1. Restart the plugin (`npm run dev`) and reopen the Figma sandbox, then watch DevTools for `[UI][Perf]` logs while toggling selections.

## 2025-10-26 — Remote auth portal did not promote paid accounts
- Time: 2025-10-26T10:15:00Z
- Summary: Designers could open the hosted auth portal, sign in, and still see the Analyze CTA blocked because the runtime never received a matching account status update.
- Root Cause: The auth iframe posts messages where the plan lives under `payload.data.attributes.planSlug` (e.g., `professional-monthly`) or `payload.meta.subscription=free_trialing`. Our extractor only scanned the first payload layer and recognized a tiny set of status strings, so remote messages were discarded.
- Changes:
  - `ui/src/App.tsx` — broadened auth status normalization to walk nested payload objects, added synonyms for paid/trial/free plans, and tightened the candidate queue to avoid runaway traversal.
  - `ui/src/__tests__/App.auth-sync.spec.tsx` — covered nested `planSlug` and `subscription` payloads to ensure `SYNC_ACCOUNT_STATUS` is dispatched.
- Verification Steps:
  1. `npx vitest run ui/src/__tests__/App.auth-sync.spec.tsx`

## 2025-10-25 — Auth status payload compatibility
- Time: 2025-10-25T06:45:00Z
- Summary: Sign-in still stalled for some designers because the auth portal sent `{ payload: { status: "trial" } }`, which the UI ignored, leaving credits stuck on “anonymous”.
- Root Cause: `extractAuthStatusFromMessage` only scanned top-level keys when validating incoming postMessages, so nested payloads failed the known-key check and were discarded before sync.
- Changes:
  - `ui/src/App.tsx` — expanded the auth status extractor to inspect nested `payload` objects while keeping the existing type/source gating for authenticity.
  - `ui/src/__tests__/App.auth-sync.spec.tsx` — added coverage ensuring payload-wrapped statuses now trigger `SYNC_ACCOUNT_STATUS`.
- Verification Steps:
  1. `npx vitest run ui/src/__tests__/App.auth-sync.spec.tsx`

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

## 2025-10-26 — Desktop auth CTA no-ops on remote endpoints
- Time: 2025-10-26T08:17:00Z
- Summary: Clicking “Sign In” inside the desktop plugin opened an external browser without upgrading credits, leaving login “stuck”.
- Root Cause: Figma desktop launches `openExternal` windows without a shared `postMessage` context, so the runtime never received the auth portal callback. Our safety net only auto-promoted when hitting localhost, so remote/staging flows stayed anonymous.
- Changes:
  - `src/runtime/analysisRuntime.ts`, `src/main.ts` — include the resolved auth URL in `SELECTION_STATUS` payloads and accept UI-originated auth launches to prevent double-opening.
  - `ui/src/App.tsx` — surface the portal URL, attempt a `window.open` with structured `[AuthBridge]` diagnostics, and fall back to the runtime if the shell blocks popups.
  - `src/types/messages.ts` — extended bridge contract so `OPEN_AUTH_PORTAL` carries `openedByUi` metadata and `SELECTION_STATUS` optionally includes `authPortalUrl`.
  - Tests in `ui/src/__tests__/App.auth-sync.spec.tsx`, `tests/runtime/analysis-runtime.cache.test.ts` — captured both popup paths and contract changes.
- Verification Steps:
  1. `npx vitest run ui/src/__tests__/App.auth-sync.spec.tsx`
  2. `npx vitest run tests/runtime/analysis-runtime.cache.test.ts`
  3. `npx vitest run tests/ui/app.test.tsx`

## 2025-10-27 — Auth portal handshake regression probe (temporary)
- Time: 2025-10-27T11:36:00Z
- Summary: Sign-in still fails to unlock paid access on UXBiblio.com; temporarily dropped `noopener` so the popup keeps `window.opener`, letting us confirm whether the portal can relay account status before investing in a hardened relay.
- Root Cause: Pending — diagnosing message bridge loss when the popup is isolated.
- Changes:
  - `ui/src/App.tsx` — logged `window.open` opener availability, tracked normalization fallbacks for unknown plan tokens, traced pending account status synchronization, and removed the `noopener,noreferrer` feature string (restoring the default opener) for this verification pass.
  - `ui/src/__tests__/App.auth-sync.spec.tsx` — aligned the auth-window expectation with the temporary two-argument `window.open` call.
- Verification Steps:
  1. `npx vitest run ui/src/__tests__/App.auth-sync.spec.tsx`

## 2025-10-27 — Manifest cleanup and packaging alignment
- Time: 2025-10-27T12:20:00Z
- Summary: Trimmed duplicate manifests and reset submission output so only the production package is archived; local development now uses a dedicated DEV manifest.
- Root Cause: Repo carried both DEV and PROD manifest copies plus a stale `submission/dev/` bundle, making it unclear which manifest powered the live build.
- Changes:
  - `manifest.json` — renamed the local manifest to `(DEV)` and assigned `uxbiblio-analyzer-dev` so Figma sandboxes the side-loaded build.
  - `manifest.prod.json` — captured the production manifest used for packaging.
  - `manifest.json`, `manifest.prod.json` — exposed a “Debug Tracing” menu command that boots the controller with DEBUG_FIX logging when selected in Figma.
  - `src/runtime/analysisRuntime.ts`, `scripts/package-figma-plugin.mjs` — added dedicated `Auth` channel logging during portal opens, UI syncs, and auto-promotion checks; packaging still sources `manifest.prod.json` for production archives.
  - `tests/integration/characterization/manifest-baseline.test.ts` — updated expectations for the DEV manifest.
- Verification Steps:
  1. `npm run package:figma`

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

## 2025-10-21 — Clipboard debug copy flagged for DOM XSS
- Time: 2025-10-21T14:43:03Z
- Summary: Static analysis reported a DOM-based XSS issue when copying debug payloads from the Analysis tab using the clipboard helper.
- Root Cause: The legacy `execCommand` fallback appended a hidden `<textarea>` seeded with the raw analysis JSON, enabling hostile payloads to reach the DOM when the async Clipboard API was unavailable.
- Changes:
  - `ui/src/utils/clipboard.ts` — removed the DOM-appending fallback, now rely solely on `navigator.clipboard.writeText` and emit structured warnings when the API cannot be used.
  - `ui/src/App.tsx`, `ui/src/components/layout/AnalysisTabsLayout.tsx`, `ui/src/styles/layout/analysis-shell.css`, `ui/src/__tests__/App.debug-copy-analysis.spec.tsx` — surfaced a manual-copy fallback panel that auto-selects the payload and guides operators through keyboard-copy when the async API is unavailable.
- Verification Steps:
  1. `npx vitest run ui/src/__tests__/App.debug-copy-analysis.spec.tsx`
  2. `snyk code test`

## 2025-10-21 — Local auth auto-promotion bypassed in dev builds
- Time: 2025-10-21T18:45:00Z
- Summary: Local sign-in flows never auto-promoted anonymous accounts because the runtime could not detect that the analysis endpoint was pointing at localhost. Added structured logging and now ship a fallback hostname parser so the flow works even when `URL` is missing.
- Root Cause: Figma’s main-thread environment exposes no global `URL`, so locality checks previously failed. Without a hostname the runtime assumed a remote endpoint, kept the production auth portal URL, and skipped the auto-promotion branch.
- Changes:
  - `src/utils/url.ts` — introduced `extractHostname`, a lightweight parser that uses the native `URL` when available and falls back to regex-based parsing (supports IPv6, credentials, and custom ports).
  - `src/runtime/analysisRuntime.ts` — replaced `safeParseUrl` with the new helper, logged the detection source, and continued auto-promoting when the fallback parser returns localhost.
  - `src/main.ts` — reused the helper so auth portal resolution matches runtime logic and records whether a native or fallback parse was used.
  - `tests/runtime/analysis-runtime.locality.test.ts` — now asserts auto-promotion succeeds with and without `globalThis.URL` to cover both environments.
- Verification Steps:
  1. `npm run test -- tests/runtime/analysis-runtime.locality.test.ts tests/utils/url.test.ts`
- Notes: Plugin bundle must be rebuilt (`npm run build:main` or restart `npm run dev`) to include the hostname parser in the Figma shell.

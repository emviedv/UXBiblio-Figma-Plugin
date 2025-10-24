# 2025-10 Live Debug Log

## 2025-10-27 — CSRF MISMATCH on proxied analysis requests
- Time: 2025-10-27T21:00:00Z
- Summary: Local plugin runs against the upstream proxy failed with `403 CSRF_MISMATCH` immediately after exporting frames; the analysis POST never carried the upstream session cookies or CSRF token, so the backend rejected every request.
- Root Cause: The proxy rewrote browser requests but discarded `Set-Cookie` headers and never replayed the `uxb_csrf` cookie or `X-CSRF-Token`. The runtime posted directly with a stateless fetch, so upstream CSRF middleware always failed the double-submit check.
- Changes:
  - `server/index.mjs` — introduced proxy-session handling, refreshed CSRF tokens on demand, and replayed stored cookies/`X-CSRF-Token` while adding DEBUG_FIX logs for session state.
  - `server/proxy-session.mjs` — added a lightweight session jar keyed by `X-UXBiblio-Proxy-Session`, tracking cookies and CSRF tokens for each runtime.
  - `server/upstream-proxy.mjs` — exposed the upstream `/api/csrf` target so the proxy can refresh tokens, and remapped analysis traffic to `/api/analyze` to honor the backend contract.
  - `src/runtime/analysisRuntime.ts`, `src/utils/analysis.ts` — generated a stable proxy session id per runtime and forwarded it on every fetch, including analysis requests, auth bridge calls, and health pings.
  - `server/index.mjs` — updated the CORS allowlist to include `X-UXBiblio-Proxy-Session`/`X-CSRF-Token`, unblocking browser preflights.
  - `tests/server/proxy-session.test.ts`, `tests/server/upstream-proxy.test.ts` — covered the new session jar behaviour and ensured upstream targets include the CSRF endpoint.
- Verification Steps:
  1. `npx vitest run tests/server/proxy-session.test.ts`
  2. `npx vitest run tests/server/upstream-proxy.test.ts`
  3. `npm run test:integration`

## 2025-10-23 — Local auth bridge token handshake failing (analysis)
- Time: 2025-10-23T17:35:35Z
- Summary: Investigated Figma auth CTA failures where the runtime logged “Unable to create Figma auth bridge token” after dispatching the local sign-in portal.
- Root Cause: The plugin shell still targets `http://localhost:3115` for auth bridge POSTs while the analysis proxy is listening on a different port, so the bridge creation request dies on a closed socket before it can return a token.
- Changes:
  - `src/runtime/analysisRuntime.ts` — added `[Auth] Creating auth bridge token request` diagnostics and normalized unknown error payloads (message/name/prototype/keys) so we can separate port mismatches from disabled bridge stubs or malformed responses.
  - `src/main.ts` — derived the localhost auth portal port from `UXBIBLIO_ANALYSIS_URL` so the portal and bridge calls follow whatever loopback port the dev proxy is using (fallback to 3115 when no port is supplied).
  - `tests/runtime/main/plugin-runtime.contract.test.ts` — asserted the `SELECTION_STATUS` payload and bridge creation both mirror the localhost port, preventing regressions when engineers swap servers.
- Verification Steps:
  1. Restart the local analysis proxy on port 3115 (`PORT=3115 npm run dev:server`) or rebuild the plugin after pointing `UXBIBLIO_ANALYSIS_URL` at the active server port, then relaunch the plugin to capture the new logs.
  2. `npm run test -- tests/runtime/main/plugin-runtime.contract.test.ts`

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

## 2025-10-29 — Local auth portal opened over HTTP with TLS analysis base
- Time: 2025-10-29T16:20:00Z
- Summary: Sign-in attempts defaulted to `http://localhost:3115/auth` even when the local analysis server was running with HTTPS, causing mixed-content blocks in Figma’s embedded browser.
- Root Cause: `resolveAuthPortalUrl` hard-coded the local auth URL to HTTP and ignored the protocol advertised by `UXBIBLIO_ANALYSIS_URL`, so TLS-enabled dev environments still launched the non-secure portal.
- Changes:
  - `src/main.ts` — mirror the analysis base protocol when composing the local auth portal URL (with IPv6-safe formatting) so HTTPS stays intact when TLS is configured.
- Verification Steps:
  1. `npm run typecheck`
- Notes: Rebuild the plugin (`npm run build` or restart `npm run dev`) so Figma picks up the protocol update.

## 2025-10-30 — Dev auth bridge stub unblocks local sign-in
- Time: 2025-10-30T10:08:00Z
- Summary: Added a local-only auth bridge stub so Figma plugin sessions can generate bridge tokens when the analysis proxy runs on localhost, restoring the sign-in flow without relying on production infrastructure.
- Root Cause: The runtime derived its auth bridge base from the local analysis endpoint (`http://localhost:3115`), but the dev server neither exposed `/api/figma/auth-bridge` nor listened on port 3115, so bridge creation threw network errors and the portal never completed.
- Changes:
  - `server/auth-bridge-dev.mjs` — introduced an in-memory token store that mints short-lived bridge tokens, completes them after a brief delay, and simulates consume/expiry semantics for localhost.
  - `server/index.mjs` — wired the stubbed auth routes (`/api/figma/auth-bridge*` + `/auth`) when `NODE_ENV !== "production"`, expanded CORS allowances to cover GET, and logged stub issuance for diagnostics.
  - `server/__tests__/auth-bridge-dev.spec.mjs` — covered token lifecycle (pending → completed → consumed/expired) with configurable timings and validated the HTML auth portal stub.
  - `src/runtime/analysisRuntime.ts` — extended the auth bridge failure logging to capture error metadata, making the root cause visible in plugin logs.
- Verification Steps:
  1. `node --test server/__tests__/auth-bridge-dev.spec.mjs`
  2. `npx vitest run tests/runtime/main/plugin-runtime.contract.test.ts`
- Notes: Restart the local analysis server (`PORT=3115 npm run dev:server` if you want the stub on the default port) and rebuild the plugin main bundle (`npm run build:main` or restart `npm run dev`) so the stubbed endpoint and enhanced logging load into the running session.

## 2025-10-24 — Logout token downgrades credit banner
- Time: 2025-10-24T03:55:00Z
- Summary: Fixed the top banner staying “Signed in” after users sign out by honoring `logged_out` metadata and aligning runtime normalization with the UI bridge.
- Root Cause: The runtime’s `normalizeAccountStatus` only understood `pro`, `trial`, and `anonymous`, so metadata tokens like `logged_out` were ignored and the cached “pro” status persisted.
- Changes:
  - `src/runtime/analysisRuntime.ts` — expanded normalization to the full token set used by the UI, added `[DEBUG_FIX][AccountStatusNormalization]` traces, and reused the mappings to downgrade cached statuses.
  - `tests/runtime/analysis-runtime.cache.test.ts` — added a regression to confirm stored paid snapshots revert to `anonymous` when metadata reports a logout token.
- Verification Steps:
  1. `npx vitest run tests/runtime/analysis-runtime.cache.test.ts`
  2. `npm run test`
- Notes: Rebuild the plugin main bundle (`npm run build:main` or restart `npm run dev`) so the updated runtime ships to the running plugin.

## 2025-10-30 — Local hostname normalization restores dev auto-promotion
- Time: 2025-10-30T12:05:00Z
- Summary: Cleaned up hostname parsing so localhost endpoints with explicit ports are recognised as local, allowing the dev auth bridge to auto-promote newly authenticated accounts.
- Root Cause: Figma’s polyfilled `URL` object can return `hostname` values suffixed with `:port`. Our locality helper compared the raw string directly, so `localhost:4292` slipped past the loopback checks and forced the remote auth portal path.
- Changes:
  - `src/utils/url.ts` — sanitises native hostname resolutions by trimming bracketed IPv6 wrappers and numeric port suffixes, and exposes a shared `isLocalHostname`.
  - `src/main.ts` — reuses the shared locality helper so auth portal resolution matches runtime behaviour.
  - `src/runtime/analysisRuntime.ts` — switches to the shared helper and emits `[DebugFix][HostnameNormalization]` diagnostics when `DEBUG_FIX` tracing is enabled.
  - `tests/utils/url.test.ts` — adds coverage for native port-suffixed hostnames and loopback checks (localhost, 127/8, IPv6).
- Verification Steps:
  1. `npm run test -- tests/utils/url.test.ts`
  2. `npm run test`
- Notes: Rebuild the plugin main bundle (`npm run build:main` or restart `npm run dev`) so the sanitised hostname logic ships in the running runtime.

## 2025-10-23 — Local analyze preserved post-auth
- Time: 2025-10-23T16:11:00Z
- Summary: Signing in via the local auth bridge no longer reverts to anonymous when Analyze runs; the runtime now retains the stored trial/pro snapshot on localhost.
- Root Cause: `ensureCreditsLoaded()` always reset clientStorage to `anonymous` whenever `__ENABLE_LOCAL_AUTO_PROMOTION__` was falsy, so paid states from the auth bridge were wiped just before each analysis.
- Changes:
  - `src/runtime/analysisRuntime.ts` — removed the unconditional reset, preserves stored credits for local sessions, initialises anonymous defaults only when no snapshot exists, and re-syncs selection status after portal launches while auto-promotion is disabled.
  - `tests/runtime/analysis-runtime.cache.test.ts` — adds coverage ensuring authenticated trials can analyze locally with auto-promotion disabled and keeps expectations for anonymous baseline flows.
- Verification Steps:
  1. `npx vitest tests/runtime/analysis-runtime.cache.test.ts`
- Notes: Rebuild the plugin main bundle (`npm run build:main` or restart `npm run dev`) so the updated runtime loads inside the Figma session.

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

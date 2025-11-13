# 2025-11 Live Debug Log

## 2025-11-05 — Auth bridge hitting UI server port
- Time: 2025-11-05T04:46:00Z
- Summary: Local sign-in kept failing CORS because the compiled plugin still targeted the UI host on port 3115; updated the analysis base URL to point at the proxy on 4292.
- Root Cause: `.env.local` configured `UXBIBLIO_ANALYSIS_URL=http://localhost:3115`, so the runtime posted `/api/figma/auth-bridge` to the UI process, which lacks `Access-Control-Allow-Origin`. The actual proxy (port 4292) never saw the request.
- Changes:
  - `.env.local` — set `UXBIBLIO_ANALYSIS_URL` to `http://localhost:4292` so future builds aim auth+analysis traffic at the proxy.
- Verification Steps:
  1. Rebuild the main bundle (`npm run build:main` or restart `npm run dev`) to embed the new env value, then relaunch the plugin and retry sign-in.
- Notes: Keep `npm run dev:server` bound to port 4292 (default) so auth bridge and analysis share the same proxy origin.

## 2025-11-05 — Dev auth portal pre-consumed bridge tokens
- Time: 2025-11-05T05:36:03Z
- Summary: The local auth portal stub consumed bridge tokens immediately (`?consume=1`), so the runtime only saw `410 Gone` responses and never marked the account signed in.
- Root Cause: `renderDevAuthPortalPage` polled `/api/figma/auth-bridge/{token}?consume=1`, which removed the token from the in-memory store before the runtime’s poll executed.
- Changes:
  - `server/auth-bridge-dev.mjs` — dev portal polls without the consume flag so the runtime owns token consumption.
  - `server/__tests__/auth-bridge-dev.spec.mjs` — asserts the HTML no longer embeds `?consume=1` to lock regression coverage.
- Verification Steps:
  1. `node --test server/__tests__/auth-bridge-dev.spec.mjs`
  2. Rebuild the plugin (`npm run build:main` or restart `npm run dev`) and relaunch the Figma session to load the updated portal script.

## 2025-11-12 — Auth Bridge API Base URL Null Reference Fix
- Time: 2025-11-12T21:54:00Z
- Summary: Auth bridge token creation succeeded but polling failed because `bridgeApiBaseUrl` resolved to `null`, causing fetch requests to fail with network errors.
- Root Cause: `resolveBridgeApiBaseUrl()` returned `null` when unable to derive API base from either analysis endpoint or auth portal URL, causing auth bridge endpoints to be constructed with invalid URLs like `null/api/figma/auth-bridge`.
- Changes:
  - `src/runtime/analysisRuntime.ts` — Added `effectiveBridgeApiBase` fallback that ensures valid API base URL:
    ```typescript
    const effectiveBridgeApiBase = bridgeApiBaseUrl || deriveApiBaseUrl(analysisEndpoint) || "";
    ```
  - Updated all auth bridge URL constructions to use `effectiveBridgeApiBase` instead of `bridgeApiBaseUrl`
  - Enhanced debug logging to include both original and effective API base URLs
- Verification Steps:
  1. `node --test server/__tests__/auth-bridge-dev.spec.mjs` — All 3 tests pass
  2. `npm test -- ui/src/__tests__/App.nav-auth-signin.spec.tsx` — All 10 tests pass
  3. Rebuild plugin and verify auth flow works without polling errors
- Impact: Prevents auth bridge polling failures when primary API base URL resolution fails
- Notes: The fallback ensures the analysis endpoint's base URL is used when bridge-specific resolution fails, maintaining backward compatibility.

## 2025-11-13 — Auth bridge poll errors lacked diagnostics & preflight handling
- Time: 2025-11-13T03:12:00Z
- Summary: Runtime logs showed `Auth bridge poll error { error: '[object Object]' }`, obscuring the failure details when dev sessions polled localhost. Also, the dev auth bridge GET route rejected CORS preflights, so the browser never issued the actual poll request.
- Root Cause: `pollAuthBridgeToken()` stringified unknown errors before logging, so any non-Error rejection collapsed to `[object Object]`; additionally, the dev `/api/figma/auth-bridge/:token` handler only allowed `GET` and returned 405 for the required `OPTIONS` preflight when the proxy session header was set.
- Changes:
  - `src/runtime/analysisRuntime.ts` — Wrap the poll `fetch` in `normalizeUnknownError()` logging, including `errorMessage`, `errorName`, `errorPrototype`, `errorStack`, `errorKeys`, and `pollUrl`.
  - `server/index.mjs` — Added an `OPTIONS` fast-path for the dev auth bridge poll route so preflights succeed when `X-UXBiblio-Proxy-Session` is attached.
- Verification Steps:
  1. Restart `npm run dev:server` to load the updated handler, plus restart `npm run dev` (or rebuild the main bundle) so the runtime logging ships with the plugin.
  2. Trigger a local auth bridge flow; the dev server should now log the preflight 204 and subsequent GET, while the plugin logs structured poll errors (if any) instead of `[object Object]`.

## 2025-11-13 — UX Summary paragraphs duplicated when scope note mirrors summary
- Time: 2025-11-13T02:12:17Z
- Summary: UX Summary panel showed two identical paragraphs because the scope note text was injected twice—once as discrete paragraphs and again as a single block within the merged summary string—so the overview rendered both copies.
- Root Cause: `mergeSummaryContent()` concatenates `scopeNote` and `summary` as whole strings (`ui/src/utils/analysis.ts`), but `UxSummaryTab` only deduped exact paragraph strings. When the scope note includes blank lines (multiple paragraphs) and the summary repeats the same sentences without blank lines, the normalization signatures never match, so duplicates leak through.
- Changes:
  - `ui/src/components/tabs/UxSummaryTab.tsx` — Added `[SummaryTab][Paragraphs]` debug logging plus refactored paragraph preparation into reusable helpers so we can inspect scope-note vs. summary overlap without changing rendering behavior.
- Verification Steps:
  1. `npm run test -- ui/src/__tests__/App.summary-uxsignals.spec.tsx`
- Notes: The new logs surface `scopeParagraphCount`, `summaryParagraphCount`, and `overlapCount` to confirm when literal duplicates exist versus when paraphrased text needs better normalization.

## 2025-11-13 — Summary merging now normalizes paragraph boundaries before dedupe
- Time: 2025-11-13T02:18:28Z
- Summary: Enhanced the analysis normalizer so `mergeSummaryContent()` breaks both `scopeNote` and `summary` into paragraphs (matching the UI splitter) before deduping, preventing repeated prose when the raw summary already embeds the scope note.
- Root Cause: Deduplication operated on the entire field strings, so a multi-paragraph scope note (`\n\n` delimited) was treated as one chunk while the merged summary reintroduced those sentences as a single block—paragraph-level signatures never collided, allowing duplicates through.
- Changes:
  - `ui/src/utils/analysis.ts` — Imports `splitIntoParagraphs`, normalizes each field into paragraph arrays, dedupes via signatures, and emits `[AnalysisNormalizer][SummaryMerge]` DEBUG_FIX logs with paragraph counts/overlap.
  - `ui/src/components/tabs/UxSummaryTab.tsx` — Guards the tab-level `[SummaryTab][Paragraphs]` logs behind `isDebugFixEnabled()` so the extra instrumentation stays toggleable.
  - `ui/src/__tests__/normalizers/analysis.scope-note-merging.spec.tsx` — Added regression coverage proving only unique paragraphs remain after normalization when scope text is repeated in the summary payload.
- Verification Steps:
  1. `npm run test -- ui/src/__tests__/normalizers/analysis.scope-note-merging.spec.tsx`
  2. `npm run test -- ui/src/__tests__/App.summary-uxsignals.spec.tsx`
- Notes: Restart `npm run dev` (or rebuild the UI bundle) to ensure FIGMA loads the updated normalization logic.

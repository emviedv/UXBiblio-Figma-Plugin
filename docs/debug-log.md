# Debug Log

## 2025-10-20 — Restore scroll propagation through analysis cards

- Time: 2025-10-20T10:05:45Z
- Summary: Allowed wheel/trackpad events to reach the analysis scroll container by letting card surfaces expose vertical overflow and instrumented a DEBUG_FIX audit for future regressions.
- Root Cause: `[data-card-surface="true"]` enforced `overflow: hidden`, so when users hovered card-backed tabs (copywriting, heuristics, etc.) Figma treated the area as non-scrollable and swallowed wheel events before they hit `.analysis-panel`.
- Changes:
  - ui/src/styles/components/cards-base.css — removed vertical overflow clipping so cards no longer block event propagation.
  - ui/src/components/layout/utils/logCardOverflowDiagnostics.ts, ui/src/utils/debugFlags.ts, ui/src/components/layout/hooks/useAnalysisPanelDiagnostics.ts, ui/src/components/layout/AnalysisTabsLayout.tsx — added optional DEBUG_FIX logging that flags any card still reporting hidden vertical overflow.
  - tests/ui/styles/styles-contract.test.ts — asserts cards keep vertical overflow visible.
- Verification Steps:
  1) `npx vitest run tests/ui/styles/styles-contract.test.ts`
  2) `npx vitest run tests/ui/cards-layout.test.ts`

## 2025-10-19 — Instrument receipts diagnostics for stale sources

- Time: 2025-10-19T13:40:49Z
- Summary: Added structured logging to surface receipt domain concentration and malformed URLs while investigating broken/outdated source links in the plugin.
- Root Cause: Source aggregation never validated URLs or enforced domain diversity, so stale or duplicated citations surfaced untouched.
- Changes:
  - ui/src/utils/analysis.ts — log per-analysis source diagnostics, flagging missing URLs, invalid links, and domains exceeding 50% share.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/normalizers/normalizeAnalysis.sources-merge.spec.tsx`

## 2025-10-16 — Escape accessibility field ticks in prompt

- Time: 2025-10-16T14:12:42Z
- Summary: Resolved Node syntax failure by escaping inline backticks around accessibility field names inside the enhanced analysis prompt template.
- Root Cause: The template literal listed fields like `contrastScore` without escaping the surrounding backticks, so Node treated them as literal delimiters and threw `Unexpected identifier`.
- Changes:
  - server/enhanced-analysis-prompt.mjs — escaped inline code ticks for accessibility instructions so the template literal parses correctly.
- Verification Steps:
  1) `node --check server/enhanced-analysis-prompt.mjs`

## 2025-10-16 — Investigating reduced copywriting richness in Figma plugin

- Time: 2025-10-16T16:53:47Z
- Summary: Added normalization diagnostics for UX copy payloads while investigating why the Figma plugin renders less detailed copywriting guidance than the Chrome extension.
- Root Cause: Pending confirmation; early inspection shows the plugin drops structured `uxCopywriting.sections` blocks emitted by the analysis pipeline.
- Changes:
  - ui/src/utils/analysis.ts — log incoming copywriting keys and section counts to highlight data currently ignored by the plugin UI.
- Verification Steps:
  1) Trigger any analysis in the plugin with debug logging enabled and confirm `[AnalysisNormalizer][Copywriting] Raw payload snapshot` appears once the payload is received.

## 2025-10-17 — Modularized analysis styles without UI drift

- Time: 2025-10-17T10:32:27Z
- Summary: Split the monolithic `ui/src/styles.css` into focused modules for layout, skeleton progress, badges, and status banners while stabilizing sticky panel sizing.
- Root Cause: The legacy single file (≈892 LOC) made maintenance risky; initial extraction reintroduced container padding, so layout metrics flagged drift and tabs gained double gutters.
- Changes:
  - ui/src/styles/layout/analysis-shell.css — restored zero padding on `.analysis-panel`, kept responsive offsets.
  - ui/src/styles/components/analysis-progress.css, status-badges.css — new modules for skeleton/progress UI and severity/status styles; main stylesheet now imports them.
  - tests/ui/styles/styles-contract.test.ts — verifies aggregate CSS to catch missing selectors after modularization.
  - Tests across `tests/ui/analysis-layout.test.tsx` rerun to confirm layout parity.
- Verification Steps:
  1) `npx vitest run tests/ui/styles/styles-contract.test.ts`
  2) `npx vitest run tests/ui/analysis-layout.test.tsx`
  3) `npm run dev` to rebuild the plugin bundle with updated imports.

## 2025-10-18 — Restored Chrome parity for heuristics/accessibility/psychology chips

- Time: 2025-10-18T06:15:00Z
- Summary: Preserved heuristic scorecards, accessibility guardrails, and impact/psychology metadata so the Figma plugin renders the same structured chips and sections as the Chrome extension.
- Root Cause: The normalizer dropped `heuristicScorecard`, `accessibilityCheck.guardrails`, and metadata embedded in impact/psychology summaries, leaving the UI without parity cues.
- Changes:
  - ui/src/utils/analysis.ts — carried heuristic scorecards through normalization and default structured analysis.
  - ui/src/utils/analysis/heuristicScorecard.ts — new helper to sanitize scorecard entries.
  - ui/src/utils/analysis/impact.ts, ui/src/utils/analysis/psychology.ts — extracted metadata chips for impact effort/refs and psychology intent/guardrails.
  - ui/src/utils/analysis/accessibility.ts — retained guardrails from `accessibilityCheck` payloads.
  - ui/src/components/HeuristicScorecard.tsx, ImpactCard.tsx, tabs/ProductPsychologyTab.tsx, AccessibilityAccordion.tsx — rendered scorecard sections and metadata chips.
  - ui/src/app/buildAnalysisTabs.tsx — inserted scorecard block into heuristics tab.
  - Added parity tests under `ui/src/__tests__/` to cover scorecards, guardrails, and impact/psych chips.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/heuristics.scorecard.parity.spec.tsx`
  2) `npx vitest run ui/src/__tests__/accessibility.guardrail.parity.spec.tsx`
  3) `npx vitest run ui/src/__tests__/impact.psychology.parity.spec.tsx`

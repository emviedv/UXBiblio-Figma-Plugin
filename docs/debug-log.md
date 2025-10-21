# Debug Log

## 2025-10-21 — Enforce free credit gating for anonymous analyses

- Time: 2025-10-21T10:16:45Z
- Summary: Added persistent free-credit tracking and UI gating so anonymous plugin users receive eight complimentary analyses before being prompted to sign in for a trial or pro access.
- Root Cause: The plugin allowed unlimited analyses for anonymous users; no quota enforcement meant we could not steer designers toward authentication once the free allotment should end. (Risk: High — monetization blocker.)
- Changes:
  - src/runtime/analysisRuntime.ts — persisted free-credit balances via `clientStorage`, blocked new analyses when credits hit zero, and logged structured `[Credits]` diagnostics.
  - src/types/messages.ts — extended `SELECTION_STATUS` messages with a `credits` summary for the UI.
  - ui/src/App.tsx, ui/src/components/SearchBar.tsx — rendered dynamic banner copy, disabled the Analyze button when credits are exhausted, and surfaced sign-in messaging.
  - tests/runtime/analysis-runtime.cache.test.ts, tests/ui/app.test.tsx — added regression coverage for the new gating behavior.
  - docs/debug-log.md — recorded this change.
- Verification Steps:
  1) `npx vitest run tests/runtime/analysis-runtime.cache.test.ts tests/ui/app.test.tsx`
- Metrics:
  - Files: src/runtime/analysisRuntime.ts; src/types/messages.ts; ui/src/App.tsx; ui/src/components/SearchBar.tsx; tests/runtime/analysis-runtime.cache.test.ts; tests/ui/app.test.tsx; docs/debug-log.md
  - LOC Delta: +550 net (via `git diff --stat` on touched files)
  - Tests: Added runtime + UI gating cases.
  - TTD/TTF: Identified via product requirement; addressed immediately in current session.
  - Residual Risk: Account status derivation relies on metadata hints; if backend omits plan data, signed-in users might need a plugin restart to refresh credits.
  - Rollback: Revert the files listed above and re-run `npx vitest run tests/runtime/analysis-runtime.cache.test.ts tests/ui/app.test.tsx` to confirm.

## 2025-10-20 — Restore psychology technique labels from analysis payload

- Time: 2025-10-20T20:56:57Z
- Summary: Updated the psychology normalizer to honor `technique` and `trigger` fields so persuasion and behavioral cards display the analyst-provided labels instead of the generic “Persuasion Technique”/“Behavioral Trigger” placeholders.
- Root Cause: `normalizePsychologyEntry` only considered `title`, `name`, `label`, or `id`, ignoring the backend’s `technique`/`trigger` values and falling back to default category titles; the UI therefore lost the actual technique names. (Risk: Medium — analysis cards read as duplicate placeholders.)
- Changes:
  - ui/src/utils/analysis/psychology.ts — included technique/trigger/pattern/bias cues when selecting the display title for psychology items.
  - ui/src/__tests__/normalizers/normalizeAnalysis.psychology-object.spec.tsx — added regression coverage ensuring the new fields populate titles and preserve descriptions.
  - docs/debug-log.md — recorded this fix.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/normalizers/normalizeAnalysis.psychology-object.spec.tsx`

## 2025-10-18 — Align psychology/impact cards with standard chrome

- Time: 2025-10-18T00:44:04Z
- Summary: Removed the bespoke `analysis-card` shim so psychology and impact cards render with the shared `card` + `card-section` chrome and finally match the established analysis panel styling.
- Root Cause: The interim `analysis-card` surface flattened list gaps, swapped in a bespoke gradient, and bypassed the shared `card-item` scaffolding, leaving psychology and impact tabs visually divergent even after the markup rewrite. (Risk: Medium — inconsistent panel chrome.)
- Changes:
  - ui/src/components/tabs/ProductPsychologyTab.tsx, ui/src/components/ImpactCard.tsx — reverted to shared `card-item` markup and dropped the extra shim classes so spacing, dividers, and severity badges follow the base tokens.
  - ui/src/styles.css — removed the orphaned `analysis-card` import once the shim went away.
  - ui/src/styles/components/analysis-card.css — deleted redundant surface overrides.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/ProductPsychologyTab.layout.spec.tsx ui/src/__tests__/App.product-psychology.metadata.spec.tsx`

## 2025-10-18 — Clean Notable On-screen Copy fallback

- Time: 2025-10-18T00:09:32Z
- Summary: Filtered the Notable On-screen Copy fallback so the plugin only surfaces direct quote extracts or succinct labelled snippets, preventing analysis guidance from appearing as user-facing copy.
- Root Cause: `ui/src/utils/copywritingSections.ts` pulled sentences from copywriting summaries, guidance bullets, and heuristic descriptions whenever `uxCopywriting.sections` were absent, so analysis directives like “Move guarantee copy above CTA.” rendered under Notable On-screen Copy. (Risk: Medium — user-facing copy tab displayed analyst commentary instead of actual UI copy.)
- Changes:
  - ui/src/utils/copywritingSections.ts — reworked the Notable On-screen Copy synthesizer to extract quoted snippets, discard directive phrases, and emit DEBUG_FIX diagnostics when analysis-only content is suppressed.
  - ui/src/__tests__/copywriting.parity.spec.tsx — updated parity expectations to assert that the fallback no longer renders the Notable section when only analysis commentary exists.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/copywriting.parity.spec.tsx`

## 2025-10-17 — Standardize psychology tab layout with shared cards

- Time: 2025-10-17T18:18:55Z
- Summary: Replaced the bespoke psychology `<article>` markup with the shared `CollapsibleCard` + `CardSection` layout, restored shared list semantics for Impact/Psychology cards, and introduced a unified `analysis-card` surface so both tabs reuse the same chrome, spacing, and severity badge placement.
- Root Cause: `ui/src/components/tabs/ProductPsychologyTab.tsx` rendered standalone `<article>` nodes with custom header/body styling, bypassing the shared card surface and section components, while `ImpactCard` skipped the list-based `card-body` scaffold and overrode the background. The divergence introduced inconsistent gutters, missing dividers, semi-transparent backgrounds, and severity copy that did not match the established badge pattern. (Risk: Medium — user-facing layout drift.)
- Changes:
  - ui/src/components/tabs/ProductPsychologyTab.tsx — swapped to shared card components, added DEBUG_FIX layout diagnostics, and displayed severity via `SeverityBadge`.
  - ui/src/components/ImpactCard.tsx — adopted the same shared card scaffolding so Impact UI matches the tab pattern and renders severity chips in the header.
  - ui/src/styles/components/analysis-card.css — new shared surface style that applies the unified gradient, border, radius, and section padding for analysis cards.
  - ui/src/styles/components/psychology-tab.css, ui/src/styles/components/impact-tab.css — aligned section spacing, typography, and metadata layout with the shared card tokens.
  - ui/src/__tests__/ProductPsychologyTab.layout.spec.tsx — new regression test verifying psychology insights mount inside shared card sections.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/ProductPsychologyTab.layout.spec.tsx`
  2) `npx vitest run ui/src/__tests__/impact.psychology.parity.spec.tsx`

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

## 2025-10-18 — Added heuristics fallback messaging

- Time: 2025-10-18T21:06:45Z
- Summary: Introduced default copy for heuristics that return no explicit observation so the analysis tab communicates when a Nielsen heuristic was evaluated without findings.
- Root Cause: The normalizer populated canonical heuristic titles without descriptions, producing blank cards in the UI and leaving teams unsure whether analysis skipped those areas.
- Changes:
  - ui/src/utils/analysis/heuristics.ts — ensure every heuristic receives baseline copy when description text is absent.
  - ui/src/__tests__/normalizers/normalizeAnalysis.heuristics-ten.spec.tsx — verify fallback copy appears for provided and inferred heuristics.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/normalizers/normalizeAnalysis.heuristics-ten.spec.tsx`

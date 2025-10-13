## 2025-10-13 — Restore sticky analysis sidebar

- Time: 2025-10-13T00:47:20Z
- Summary: Sidebar now stays pinned while the analysis panel scrolls by letting the grid allow sticky positioning and preventing the nav column from stretching to the full panel height.
- Root Cause: `.analysis-grid` forced `overflow: hidden` and the sidebar column stretched to match the tallest panel content, so the sticky offset never engaged and the entire sidebar scrolled out of view.
- Changes:
  - ui/src/styles.css — set `.analysis-grid` overflow to `visible` and changed `.analysis-navigation` to `align-self: start` so sticky positioning activates.
- Verification Steps:
  1) Load an analysis with enough results to require scrolling in the main panel.
  2) Scroll the panel; confirm the sidebar remains pinned to the top of the viewport.
  3) Resize the plugin window vertically; sticky behavior persists without clipping the Upgrade CTA.

## 2025-10-13 — UX Summary default; Color Palette removed from tabs

- Time: 2025-10-13T01:04:17Z
- Summary: UX Summary now loads first, and the Color Palette tab no longer appears in the sidebar so analysis tabs focus on insight panels only.
- Root Cause: Sidebar order still defaulted to Color Palette, exposing a palette tab even when stakeholders requested it hidden; default selection did not match desired UX Summary-first workflow.
- Changes:
  - ui/src/app/buildAnalysisTabs.tsx — dropped the Color Palette descriptor so only insight tabs render.
  - ui/src/App.tsx — set `ux-summary` as the default tab, removed palette-specific state, and updated fallback logic.
  - ui/src/components/layout/AnalysisTabsLayout.tsx — simplified analyzing state handling now that palettes are not special-cased.
  - ui/src/__tests__/App.skeletons-and-tab-switching.spec.tsx, ui/src/__tests__/App.second-analysis-reset.spec.tsx — updated expectations to ensure the palette tab stays hidden while skeleton behavior remains intact.
- Verification Steps:
  1) Launch the plugin UI, start an analysis, and confirm the UX Summary tab is selected by default while results load.
  2) Verify the sidebar shows no Color Palette tab regardless of color data presence.
  3) Run `npx vitest run ui/src/__tests__/App.skeletons-and-tab-switching.spec.tsx ui/src/__tests__/App.second-analysis-reset.spec.tsx` — all tests pass.

## 2025-10-13 — Heuristic badges respect numeric scores

- Time: 2025-10-13T21:35:00Z
- Summary: Heuristic badges now compute their color from the returned score while still showing upstream severity text, and canonical heuristics are guaranteed to surface once per analysis with their captured score data.
- Root Cause: Upstream payloads sometimes shipped severity labels that did not align with the numeric score, and canonical heuristics without normalized matches disappeared from the rendered list.
- Changes:
  - ui/src/utils/analysis.ts — capture normalized five-point scores for heuristic items, merge duplicate canonical entries, and ensure fallback items cover all Nielsen heuristics.
  - ui/src/components/SeverityBadge.tsx — derive badge styling from numeric scores and surface the score alongside severity copy.
  - ui/src/components/AccordionSection.tsx, ui/src/components/AccessibilityAccordion.tsx — pass score data through so badges can render correct intents.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/normalizers/normalizeAnalysis.heuristics-object.spec.tsx ui/src/__tests__/normalizers/normalizeAnalysis.heuristics-ten.spec.tsx`

## 2025-10-14 — Collapsible analysis sidebar with live palette preview

- Time: 2025-10-14T22:18:00Z
- Summary: Added a collapse/expand control for the analysis navigation so the main insight panel can expand, and surfaced live color palette swatches during in-progress runs while preserving skeleton states.
- Root Cause: The sidebar width was fixed, leaving no way to focus on tab content in tighter workspaces, and palette colors streamed during analysis were silently ignored so QA lost parity with design guardrails.
- Changes:
  - ui/src/__tests__/App.sidebar-collapse.spec.tsx — new regression suite covering collapse control presence, layout data attributes, aria state, and accessible tab naming.
  - ui/src/components/layout/AnalysisTabsLayout.tsx — wired collapse toggle, icon-only rendering, live palette preview, and aria/title attributes.
  - ui/src/styles.css — introduced collapsed sidebar styles, toggle presentation, and analyzing layout stack to host palette + skeleton.
  - ui/src/App.tsx — persisted sidebar state, tracked live palette colors from plugin messages, and passed data into the layout.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/App.sidebar-collapse.spec.tsx`
  2) `npx vitest run ui/src/__tests__/App.analysis-grid.spec.tsx`

## 2025-10-15 — UX analysis tabs match card + badge reference layout

- Time: 2025-10-15T02:35:00Z
- Summary: Rebuilt the UX Summary and Product Psychology tabs to mirror the gradient badge layout from the reference UI, added inline color palette swatches post-analysis, and stripped Stage/Guardrail boilerplate in favor of badges, signal lists, and guardrail recommendations.
- Root Cause: The previous cards surfaced raw normalization metadata, lacked descriptive badges, and dropped captured palette colors after analysis, causing the plugin to diverge from the approved Figma mocks.
- Changes:
  - ui/src/components/primitives/Badge.tsx, ui/src/components/primitives/FacetGroup.tsx — shared primitives for gradient badges and grouped facet renders.
  - ui/src/components/tabs/UxSummaryTab.tsx, ui/src/components/tabs/ProductPsychologyTab.tsx — new tab surfaces with summary paragraphs, facets, inline palette section, and cleaned psychology parsing.
  - ui/src/components/ColorPalette.tsx — added inline variant so summary view can reuse swatch/copy controls without extra card chrome.
  - ui/src/app/buildAnalysisTabs.tsx, ui/src/App.tsx — threaded palette colors into tab builders and swapped the new tab components into the layout.
  - ui/src/styles.css — introduced token documentation header plus styling for badges, facet grids, summary sections, psychology cards, and inline palette treatment.
  - tests/ui/cards-layout.test.tsx, tests/ui/app.test.tsx, ui/src/__tests__/App.summary-view.badges.spec.tsx, ui/src/__tests__/App.product-psychology.metadata.spec.tsx — updated and added coverage for badges, palette swatches, and metadata suppression.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/App.summary-view.badges.spec.tsx ui/src/__tests__/App.product-psychology.metadata.spec.tsx`
  2) `npx vitest run tests/ui/cards-layout.test.tsx`
  3) `npm run test:integration`

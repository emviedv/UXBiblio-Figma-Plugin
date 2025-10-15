## 2025-10-17 — Sticky analysis panel exceeded viewport allowance

- Time: 2025-10-17T21:08:00Z
- Summary: Analysis panel kept overshooting the sticky height budget, forcing the page to scroll and spamming “[UI] Analysis panel layout drift detected” while skeleton overlays flooded the console.
- Root Cause: `.analysis-panel` still used content-box sizing, so its 20px padding sat on top of the sticky `max-height` measurement; the layout telemetry compared the raw client height against the sticky allowance without normalising padding/border, and skeleton logging never deduped per tab.
- Changes:
  - ui/src/styles.css — switched the analysis panel to border-box sizing (desktop + narrow breakpoints) so padding is included in the sticky height cap.
  - ui/src/components/layout/AnalysisTabsLayout.tsx — normalised layout metrics using the element’s bounding rect, logged padding/border/box-sizing details, tagged the panel with `data-panel-drift`, and deduped skeleton overlay logs for analyze/cancel stages.
  - ui/src/__tests__/layout/analysisPanelLayout.spec.tsx, ui/src/__tests__/layout/analysisSkeletonLogging.spec.tsx — regression coverage for the height cap and skeleton log throttling.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/layout/analysisPanelLayout.spec.tsx`
  2) `npx vitest run ui/src/__tests__/layout/analysisSkeletonLogging.spec.tsx`

## 2025-10-16 — Cached “fast mode” results masking accessibility output

- Time: 2025-10-16T20:05:00Z
- Summary: Empty “fast mode” responses were cached and replayed, suppressing accessibility insights while the UI kept reporting prior failures.
- Root Cause: `createAnalysisRuntime` stored and reused structurally empty analysis payloads; the proxy parser discarded OpenAI `output_text` responses so the cache only ever saw skeletal results; the accessibility normalizer dropped string-only lists.
- Changes:
  - src/runtime/analysisRuntime.ts — bypass cached payloads with no actionable content, warn when encountered, and avoid persisting empties.
  - server/response-parser.mjs, server/index.mjs — parse `output_text` chunks, expose helper for contract tests, and log fallback context.
  - ui/src/utils/analysis/accessibility.ts — promote string arrays into card items and surface diagnostic logging for schema drift.
  - Added regression coverage: tests/runtime/analysis-runtime.cache.test.ts, server/__tests__/analysis-response-parser.spec.mjs, tests/ui/analysis-accessibility-normalizer.test.tsx.
- Verification Steps:
  1) `npx vitest run tests/runtime/analysis-runtime.cache.test.ts`
  2) `node --test server/__tests__/analysis-response-parser.spec.mjs`
  3) `npx vitest run tests/ui/analysis-accessibility-normalizer.test.tsx`

## 2025-10-16 — Analysis tab clicks revert to UX Summary

- Time: 2025-10-16T14:20:00Z
- Summary: Investigated reports that selecting Psychology (and a few other tabs) bounces back to UX Summary after the click; reproduced in the UI and traced the state transitions.
- Root Cause: `ui/src/App.tsx` contains an effect that automatically reassigns `activeTabId` whenever the chosen tab reports `hasContent === false`. That logic fires after every click in success state, so tabs that only have empty-state messaging (or whose content was normalized away) immediately revert to the default tab.
- Changes: Investigation only — no code changes yet.
- Verification Steps:
  1) Run the UI with an analysis payload that lacks psychology items.
  2) Click the Psychology tab; observe the debug log pair (`activeTabId: psychology` followed by `activeTabId: ux-summary`) confirming the forced fallback.

## 2025-10-16 — Psychology tab parity with Chrome capture

- Time: 2025-10-16T15:05:00Z
- Summary: Kept manual tab selections active in success/error states and synthesized psychology items when only summary text is returned so the plugin mirrors Chrome capture output.
- Root Cause: The tab fallback effect in `ui/src/App.tsx` always moved the user back to UX Summary when `hasContent` was false, and `normalizePsychology` dropped object-shaped payloads that only carried summary/notes fields.
- Changes:
  - ui/src/App.tsx — only auto-fallbacks when tabs disappear or while idle/ready states, added debug logging for the fallback reason.
  - ui/src/utils/analysis/psychology.ts — synthesized default items from summary-only payloads and collected loose recommendations/signals.
  - Added regression coverage: `ui/src/__tests__/App.psychology-empty-tab-selection.spec.tsx`, `ui/src/__tests__/App.psychology-summary-only-content.spec.tsx`, `ui/src/__tests__/normalizers/analysis.normalize-psychology.summary-only.spec.tsx`.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/normalizers/analysis.normalize-psychology.summary-only.spec.tsx`
  2) `npx vitest run ui/src/__tests__/App.psychology-empty-tab-selection.spec.tsx`
  3) `npx vitest run ui/src/__tests__/App.psychology-summary-only-content.spec.tsx`

## 2025-10-15 — Trial CTA copy normalized

- Time: 2025-10-15T19:05:00Z
- Summary: Adjusted the trial banner CTA in the analysis header to sentence case so it matches the latest UX writing guidance.
- Root Cause: `ui/src/App.tsx` hard-coded the callout copy in title case (`Try 7-day Trial For Free`), conflicting with the sentence-case rule for navigation CTAs.
- Changes:
  - ui/src/App.tsx — updated the banner CTA string to `Try 7-day trial for free`.
- Verification Steps:
  1) `npm run lint`

## 2025-10-15 — Lint guard for App UX Copy test

- Time: 2025-10-15T18:45:00Z
- Summary: ESLint flagged the App UX Copy regression test for using an `any` cast and the Recommendations accordion for a redundant region role; updated the test harness override and cleaned the markup so lint passes again.
- Root Cause: The test rethrew console errors by casting to `any[]`, tripping `@typescript-eslint/no-explicit-any`, and the accordion section manually set `role="region"` even though the element already exposes that implicit role when labelled.
- Changes:
  - ui/src/__tests__/App.ux-copy-heading-only.spec.tsx — reuse `Parameters<typeof console.error>` to forward arguments without `any`.
  - ui/src/components/RecommendationsAccordion.tsx — removed the redundant `role="region"` attribute.
- Verification Steps:
  1) `npm run lint`

## 2025-10-14 — UX Copy tab missing due to prompt regression

- Time: 2025-10-14T15:30:00Z
- Summary: Restored the UX Copy tab by reintroducing the `uxCopywriting` contract to the prompt, relaxing UI gating to honor heading-only payloads, and adding an inline empty-state notice so analysts understand when copy guidance is limited.
- Root Cause: `server/enhanced-analysis-prompt.mjs` v3.4.1 enumerated root keys without `uxCopywriting`, so the upstream completion omitted copy guidance and the UI filtered the tab away when only a heading was present.
- Changes:
  - server/enhanced-analysis-prompt.mjs — reinstated UX copywriting instructions, escaped inline code in the template literal, and updated the JSON contract example.
  - src/config/prompt-version.json — bumped prompt version to `3.4.2` so cache invalidation and diagnostics track the new schema.
  - ui/src/app/buildAnalysisTabs.tsx — treats heading-only payloads as content so the tab stays visible.
  - ui/src/components/CopywritingCard.tsx & ui/src/styles.css — render a Frame-icon notice when only the heading is available, maintaining landmark content and accessible messaging.
  - ui/src/utils/analysis.ts — warn only when copywriting data is entirely absent (no heading or details).
  - Added coverage: ui/src/__tests__/App.ux-copy-heading-only.spec.tsx, ui/src/__tests__/app.buildAnalysisTabs.copywriting.spec.tsx, ui/src/__tests__/normalizers/analysis.normalize-copywriting.spec.tsx, server/__tests__/enhanced-analysis-prompt.contract.spec.mjs.
- Verification Steps:
  1) `node --test server/__tests__/enhanced-analysis-prompt.contract.spec.mjs`
  2) `npx vitest run ui/src/__tests__/app.buildAnalysisTabs.copywriting.spec.tsx ui/src/__tests__/App.ux-copy-heading-only.spec.tsx ui/src/__tests__/normalizers/analysis.normalize-copywriting.spec.tsx`
  3) Trigger an analysis with heading-only copy; confirm the UX Copy card shows the heading plus the new notice without empty warnings.

## 2025-10-14 — Compatibility checker filters ES2018 spread only

- Time: 2025-10-14T10:10:00Z
- Summary: Tightened the Figma compatibility scan so it only flags ES2018 object rest/spread, eliminating false warnings caused by legitimate ES2017 rest parameters and call spreads in the bundled output.
- Root Cause: The spread detector treated every `...` token as unsafe without evaluating surrounding syntax, so ES2017-compliant rest arguments triggered 64 warnings even though the bundles already targeted `es2017`.
- Changes:
  - scripts/check-figma-compat.cjs — built a bracket-context map during scanning and limited the spread validator to cases inside object literals/destructuring.
- Verification Steps:
  1) `npm run compatibility-check`

## 2025-10-13 — Invalidate cached analyses on prompt upgrades

- Time: 2025-10-13T23:05:00Z
- Summary: Selection cache now keys on the shared prompt version so prompting changes trigger fresh runs; every analysis response carries the version for downstream checks and logging.
- Root Cause: `src/main.ts` only keyed cache entries by selection ID and node version, so unchanged frames kept replaying pre-upgrade JSON; the analysis payload omitted `promptVersion`, leaving the UI unable to detect the mismatch.
- Changes:
  - src/config/prompt-version.json — added a single source of truth for the current prompt.
  - server/enhanced-analysis-prompt.mjs — imported the shared version to keep the server in lock-step with the UI.
  - src/main.ts — wrote the prompt version into the cache, evicted stale entries when it changes, and expanded analysis debug logs to trace cache decisions.
  - src/utils/analysis-payload.ts — injected `promptVersion` into forwarded responses with diagnostics when the upstream payload omits it.
  - ui/src/utils/analysis.ts & ui/src/utils/analysis/types.ts — included `promptVersion` in normalized results and logged missing values for easier QA.
- Verification Steps:
  1) `npm run test -- ui/src/__tests__/normalizers/normalizeAnalysis.defaults-and-obs.spec.tsx`

## 2025-10-13 — Analysis normalization pipeline modularized

- Time: 2025-10-13T13:13:03Z
- Summary: Broke the monolithic analysis normalizer into composable helpers, introduced centralized defaults/guards, and added characterization tests so downstream UI keeps receiving the same structured payloads.
- Root Cause: `ui/src/utils/analysis.ts` grew past 1k lines with duplicated parsing logic, making it risky to touch and hard to ensure DRY behavior across sections.
- Changes:
  - ui/src/utils/analysis.ts — orchestrates section normalizers, centralizes defaults with `createEmptyAnalysis`, adds `asRecord` guard, iterative OBS counter, and shared receipts merge helper.
  - ui/src/utils/analysis/** — new modules for accessibility, heuristics, psychology, impact, sources, strings, etc., each carrying the existing parsing logic with localized logger usage.
  - ui/src/__tests__/normalizers/*.spec.tsx — added contract specs for defaults, confidence, and payload extraction; ran full normalizer suite to lock behavior.
  - docs/refactors/2025-10-analysis-utils-refactor.md — documented the refactor scope and verification.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/normalizers`
  2) Spot-check debug output for heuristics/psychology runs to ensure logger messages still appear during keyed-object parsing.

## 2025-10-13 — Analysis panel visibility + skeleton gating

- Time: 2025-10-13T12:32:21Z
- Summary: Restored one-at-a-time tab rendering, kept prior-run content visible during new analyses, and surfaced the active tab name inside the skeleton placeholder; added guard logs to flag panel visibility regressions.
- Root Cause: The CSS never overrode the base display for `[hidden]` sections, so Figma’s webview rendered every tab stack simultaneously. In addition, the layout forced the analyzing skeleton for all tabs, even when they already had content from the previous run, and the skeleton copy never indicated which tab you were viewing.
- Changes:
  - ui/src/styles.css — explicitly hide `.analysis-panel-section[hidden]`.
  - ui/src/components/layout/AnalysisTabsLayout.tsx — only show the analyzing/cancelling placeholder when the tab lacks content, log unexpected visibility states, warn if `render()` returns nothing when `hasContent` is true, and render the current tab label inside the skeleton.
- Verification Steps:
  1) With no selection, confirm only the active tab renders “No frame selected” instead of duplicating the empty notice across tabs.
  2) Run an analysis, click into a populated tab, and trigger another run; the existing content should remain while empty tabs show skeletons.
  3) While analyzing/cancelling, check that the skeleton headline includes the tab name (e.g., “Heuristics”).
  4) Watch debug output — no `[UI] Unexpected analysis panel visibility` warnings should appear during normal tab switching.

## 2025-10-13 — Sidebar toggle moved to footer; search container padding +4px

- Time: 2025-10-13T04:20:00Z
- Summary: Relocated the sidebar expand/collapse control to the end of the sidebar and increased the Search section container padding by 4px (top and bottom) for better spacing.
- Root Cause: The toggle was embedded next to the first tab item, which made its placement feel crowded and inconsistent with expected affordance; the search container vertical padding felt tight.
- Changes:
  - ui/src/components/layout/AnalysisTabsLayout.tsx — rendered a new `.analysis-collapse-footer` after the tablist and moved the toggle there.
  - ui/src/styles.css — added `.analysis-collapse-footer` styles and removed top overlay positioning; increased `.search-section` padding from 8px to 12px.
- Verification Steps:
  1) Open the Analysis view and verify the circular toggle sits centered at the bottom of the sidebar, working in both collapsed/expanded states with correct aria attributes.
  2) Confirm the Search section has visibly more breathing room: 12px top/bottom.

## 2025-10-13 — Remove top border of first section in UX Copy

- Time: 2025-10-13T04:22:00Z
- Summary: The first section inside the UX Copy card no longer shows a top divider line.
- Root Cause: Our generic rule removed the top border only when sections were wrapped in `<li>` elements (`.card-body > li:first-child .card-section`). UX Copy renders its sections directly inside a `.copywriting-content` div, so the rule didn’t apply.
- Changes:
  - ui/src/styles.css — added `.copywriting-content > .card-section:first-child { border-top: none; padding-top: 0; }`.
- Verification Steps:
  1) Navigate to the UX Copy tab with content.
  2) Observe the first section (Summary or Guidance) renders with no top border; subsequent sections retain the subtle divider.

## 2025-10-13 — Collapse icon: remove darker bg, tighten padding by ~3px

- Time: 2025-10-13T04:27:00Z
- Summary: The sidebar collapse/expand icon no longer has a tinted background; its hit area was reduced to trim ~3px of visual padding around the glyph.
- Root Cause: The circular toggle’s white tint read as a darker plate against the nav and the icon felt overly padded.
- Changes:
  - ui/src/styles.css — set `.analysis-collapse-toggle` background to transparent and reduced width/height from 32px to 26px; hover state keeps border emphasis without background fill.
- Verification Steps:
  1) In the Analysis view, inspect the bottom toggle: no filled background in default/hover states.
  2) The control remains keyboard-focusable with a visible focus ring.

## 2025-10-13 — Standardize empty state height to “No frame selected”

- Time: 2025-10-13T04:33:00Z
- Summary: All empty states (including analyzing skeletons and generic empty messages) now use the same height as the “No frame selected” empty state by making each active tab panel section fill the analysis panel.
- Root Cause: Some empty states expanded or collapsed based on inner content (progress, skeleton lines), leading to inconsistent vertical heights.
- Changes:
  - ui/src/styles.css — set `.analysis-panel > .analysis-panel-section` to `display:flex; flex-direction:column; flex:1; min-height:0;` so `.tab-empty` with `height:100%` fills the panel in every state.
- Verification Steps:
  1) Load initial state (No frame selected) and note empty-state height.
  2) Trigger Analyzing and Error states; verify the empty state footprint matches the initial one.

## 2025-10-13 — Search section padding +4px (16px top/bottom)

- Time: 2025-10-13T04:38:00Z
- Summary: Increased the searchbar section’s vertical padding by an additional 4px (now 16px top and bottom) for improved breathing room.
- Root Cause: Earlier change set it to 12px; design requested another +4px.
- Changes:
  - ui/src/styles.css — `.search-section { padding: 16px 16px; }`
- Verification Steps:
  1) Open the Analysis view; measure the search bar container top/bottom padding (should be 16px).
  2) Confirm search input and Analyze button heights remain unchanged.

## 2025-10-13 — Unify top-level paddings to 20px

- Time: 2025-10-13T04:44:00Z
- Summary: Standardized paddings and primary gaps across key sections to 20px for consistency: main analysis panel, search section, and top nav.
- Root Cause: Header, search, and content used 8–20px mixes (8/16), creating uneven vertical rhythm.
- Changes:
  - ui/src/styles.css — set `.analysis-panel { padding: 20px }`, `.search-section { padding: 20px }`, `.header-container { padding: 20px }`.
- Verification Steps:
  1) Verify header, search section, and analysis panel all show 20px padding on all sides.
  2) Ensure inner control heights and the 20px content gaps remain correct.

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

## 2025-10-13 — Search filter and Analyze button locked to 60px

- Time: 2025-10-13T07:29:40Z
- Summary: Search input and Analyze button now lock to a 60px row so the toolbar reads as a single band even on taller window layouts.
- Root Cause: The default control token (40px) kept resurfacing, so the toolbar height drifted between refreshes and the controls never reached the requested 60px.
- Changes:
  - ui/src/styles.css — introduced `--uxb-search-control-height`, aligned the grid toolbar to it, stretched the search input, and bound the Analyze button to the same measurement.
- Verification Steps:
  1) Open the UX Analysis tab and confirm both controls remain 60px tall across window sizes and theme toggles.

## 2025-10-13 — Search toolbar reverts to 40px control token

- Time: 2025-10-13T07:17:57Z
- Summary: Restored the search toolbar to the standard 40px control height while keeping the grid alignment, matching the latest request.
- Root Cause: The 60px variant no longer matched the desired spec and left the header feeling oversized relative to other controls.
- Changes:
  - ui/src/styles.css — removed the dedicated 60px token, pointed the toolbar, input, and Analyze button back to `--uxb-control-height`, and kept the grid layout for consistent alignment.
- Verification Steps:
  1) Reload the UX Analysis tab and confirm the search field and Analyze button both render at 40px tall with even top/bottom edges.

## 2025-10-13 — Search toolbar tightened to 30px

- Time: 2025-10-13T07:23:36Z
- Summary: Narrowed the search input and Analyze button to 30px while keeping them aligned and independent of other primary buttons.
- Root Cause: Updated spacing guidance favors a slimmer toolbar row so the header stays compact alongside the navigation chips.
- Changes:
  - ui/src/styles.css — added `--uxb-search-control-height` at 32px (enforced via min/max), shifted the toolbar to a simple flex form layout, applied the token to the search input and Analyze button, and introduced 8px vertical padding on the toolbar container while leaving global controls at 40px.
- Verification Steps:
  1) Reload the UX Analysis tab and confirm both controls measure 30px tall with consistent top/bottom edges.

## 2025-10-13 — Sidebar toggle centered above UX Summary tab

- Time: 2025-10-13T07:31:40Z
- Summary: Sidebar collapse toggle now floats above the UX Summary tab pill with a soft white background so it’s easier to discover without crowding the tab label.
- Root Cause: The previous inline placement pushed the toggle into the tab’s right edge and, with a transparent background, it blended into the nav.
- Changes:
  - ui/src/styles.css — gave the first tab extra top padding, positioned the toggle over the tab center, and set default/hover states to a white tint (18%) with matching focus ring.
- Verification Steps:
  1) Toggle the sidebar open/closed and confirm the circular control sits centered above UX Summary in both states with the white tint visible.

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

## 2025-10-19 — UX summary metadata trimmed; typecheck restored

- Time: 2025-10-19T01:51:00Z
- Summary: Removed prefixed Title/Description lines from the UX Summary card and resolved the downstream TypeScript regression so renders stay clean and builds stay green.
- Root Cause: Normalized summaries preserved generator boilerplate that leaked into the overview paragraphs, and stricter plugin typings flagged the `openURL` usage plus incomplete `StructuredAnalysis` defaults.
- Changes:
  - ui/src/components/tabs/UxSummaryTab.tsx — filtered out metadata-prefixed lines before rendering summary paragraphs.
  - tests/ui/app.test.tsx — covered the regression to ensure Title/Description labels never surface in rendered UX summaries.
  - src/main.ts — guarded `figma.openURL` behind a capability check with a fallback notification for older host versions.
  - ui/src/App.tsx — expanded the default structured analysis stub with the required classification arrays.
  - ui/src/components/CollapsibleCard.tsx — made the title prop optional so headerless summary shells compile cleanly.
- Verification Steps:
  1) `npm run test -- tests/ui/app.test.tsx`
  2) `npm run typecheck`

## 2025-10-19 — Search toolbar height aligns with controls

- Time: 2025-10-19T02:24:00Z
- Summary: Tightened the search toolbar container so it shares the same height as the input/button controls and no longer towers above the adjacent components.
- Root Cause: Extra vertical padding left the search section 16px taller than the control-height rows, breaking the stacked header rhythm.
- Changes:
  - ui/src/styles.css — set the search toolbar to a fixed control-height row and stretched the input/button to fill it.
- Verification Steps:
  1) Load the plugin UI and confirm the search toolbar matches the Analyze button height with no additional vertical padding.

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

## 2025-10-15 — UX Summary surfaces reuse shared card styling

- Time: 2025-10-15T03:20:00Z
- Summary: Restored the UX Analysis Summary cards to the standard surface and typography tokens so the section matches other insights despite the new metadata blocks.
- Root Cause: The earlier gradient and bespoke text colors made the summary card diverge from the card system once facets/meta tags were added.
- Changes:
  - ui/src/components/tabs/UxSummaryTab.tsx — applied `data-card-surface` markers to summary sections so they inherit shared card hooks.
  - ui/src/styles.css — replaced the bespoke gradient/background/text colors with the shared card variables and adjusted typography weights.
- Verification Steps:
  1) Open the UX Summary tab and confirm the overview, meta, suggestions, and sources blocks share the same background, border, and type colors as other analysis sections.

## 2025-10-16 — Retired color palette UI and payload bindings

- Time: 2025-10-16T23:10:00Z
- Summary: Removed the Color Palette feature across plugin/runtime surfaces so analyzing and summary views focus on insight cards and unified skeletons.
- Root Cause: Palette swatches continued to render inline during analysis despite the feature being deprecated, keeping dead UI and payload plumbing alive.
- Changes:
  - src/types/messages.ts, src/main.ts, src/utils/analysis-payload.ts, src/utils/analysis.ts — dropped palette fields from plugin messages, request payloads, and cached analysis handling.
  - ui/src/App.tsx, ui/src/app/buildAnalysisTabs.tsx, ui/src/components/layout/AnalysisTabsLayout.tsx, ui/src/components/tabs/UxSummaryTab.tsx — stripped palette state, imports, and analyzing special cases so skeletons render without swatch sections.
  - Removed ui/src/components/ColorPalette.tsx, ui/src/utils/color.ts, src/utils/colors.ts plus related CSS tokens and palette styles.
  - Updated regression suites (ui/src/__tests__/App.*.spec.tsx, tests/ui/*.test.tsx, tests/runtime/analysis-payload.test.ts) to assert palette markup is absent and console errors remain silent.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/App.color-palette-removal.spec.tsx`
  2) `npx vitest run ui/src/__tests__/App.analysis-grid.spec.tsx ui/src/__tests__/App.skeletons-and-tab-switching.spec.tsx ui/src/__tests__/App.second-analysis-reset.spec.tsx`
  3) `npx vitest run tests/ui/cards-layout.test.tsx tests/ui/analysis-layout.test.tsx tests/ui/app.test.tsx tests/runtime/analysis-payload.test.ts`

## 2025-10-20 — Skeleton delay during analysis

- Time: 2025-10-20T12:55:00Z
- Summary: Prevented heavy tab bodies from rendering while an analysis is in-flight so skeleton and progress UI appear immediately, and ensured timers are cleared as soon as results/cancellations arrive.
- Root Cause: The layout eagerly executed each tab’s `render()` function even when the UI would display the analyzing skeleton, rebuilding large insight trees first and delaying the skeleton/progress UI for up to a minute on dense payloads. Additionally, `stopProgressTimer` was a no-op, leaving interval cleanup to effect timing only.
- Changes:
  - ui/src/components/layout/AnalysisTabsLayout.tsx — skipped `tab.render()` when skeletons are active, logged the deferment once per tab for debugging, and rerouted live-render checks through a guarded path.
  - ui/src/App.tsx — made `stopProgressTimer` actively clear the interval using the ref so progress ticks stop immediately on success/error/cancel and updated the callers.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/App.skeletons-and-tab-switching.spec.tsx ui/src/__tests__/App.progress-indicator.spec.tsx`
  2) Manual sanity: trigger an analysis with prior results and observe the skeleton/progress appear immediately instead of after the previous tab render completes.

## 2025-10-18 — Restore ETA callout after history cache regression

- Time: 2025-10-18T01:52:00Z
- Summary: Re-enabled the minutes-left callout in the analyzing skeleton by migrating legacy duration history and avoiding stale cached reads when the persisted list is missing.
- Root Cause: The progress timer cached an empty history once the analysis duration cache moved to the `uxbiblio.analysisDurationsMs` key, so legacy `uxbiblio.analysisDurations` data never reloaded and the ETA label stayed hidden.
- Changes:
  - ui/src/App.tsx — added history migration helpers, tracked cache invalidation when the new key is absent, and normalised legacy seconds-based entries to milliseconds.
  - ui/src/__tests__/App.progress-indicator.spec.tsx — covered the regression with ETA expectations for both modern and legacy history shapes.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/App.progress-indicator.spec.tsx`

## 2025-10-18 — Collapse toggle sits on first tab edge by default

- Time: 2025-10-18T02:20:40Z
- Summary: Sidebar now loads in the collapsed state with a compact edge-aligned icon button inside the UX Summary tab so expanding feels lighter-weight.
- Root Cause: The previous full-width toggle sat above the tab list and the navigation defaulted open, which didn’t match the revised layout spec.
- Changes:
  - ui/src/App.tsx — defaulted the sidebar state to collapsed on initial render.
  - ui/src/components/layout/AnalysisTabsLayout.tsx — embedded the collapse toggle alongside the first tab and simplified the nav markup.
  - ui/src/styles.css — introduced inline toggle styling and spacing adjustments for both expanded and collapsed nav widths.
  - ui/src/__tests__/App.sidebar-collapse.spec.tsx — updated expectations for the new default state and icon-only toggle placement.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/App.sidebar-collapse.spec.tsx`

## 2025-10-13 — Modularise analysis normalisers for DRY reuse

- Time: 2025-10-13T10:27:18Z
- Summary: Broke the monolithic `ui/src/utils/analysis.ts` into targeted modules to reduce duplication and make heuristics/accessibility/psychology normalisers easier to evolve without risking regressions.
- Root Cause: Normalisation logic for sections, recommendation aggregation, and source deduping lived in one 800+ line file, creating repeated helper implementations and shared-state coupling that complicated maintenance.
- Changes:
  - ui/src/utils/analysis.ts — restructured imports/exports to delegate to new modules, kept the public API stable, and centralised recommendation aggregation via `collectRecommendations`.
  - ui/src/utils/analysis/{heuristics,psychology,accessibility,impact,recommendations,sources,sections,strings,numbers,shared}.ts — added scoped normaliser modules and shared utilities so each domain maintains its own parsing logic.
  - ui/src/utils/analysis/index.ts — updated barrel exports for the new module layout.
  - docs/UXBiblio-Figma-Plugin-MVP-PRD.md — documented the module breakdown for future contributors.
  - ui/src/__tests__/normalizers/analysis.{extract-analysis-data,normalize-copywriting,recommendations-merge}.spec.tsx — new characterization tests locking current behaviour.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/normalizers/analysis.extract-analysis-data.spec.tsx`
  2) `npx vitest run ui/src/__tests__/normalizers/analysis.normalize-copywriting.spec.tsx`
  3) `npx vitest run ui/src/__tests__/normalizers/analysis.recommendations-merge.spec.tsx`
  4) `npx vitest run ui/src/__tests__/normalizers`

## 2025-10-13 — Harden analysis server (HTTPS + sanitized errors)

- Time: 2025-10-13T12:20:00Z
- Summary: Enabled optional HTTPS for the local analysis server and removed sensitive error details from JSON responses to address cleartext transmission and information exposure findings.
- Root Cause: The server used `node:http.createServer` (cleartext) and returned raw error objects (including upstream payloads) in responses.
- Changes:
  - server/index.mjs — added HTTPS mode via `UXBIBLIO_TLS_KEY_PATH`/`UXBIBLIO_TLS_CERT_PATH`, fell back to HTTP with a startup warning using a dynamic import, sanitized error responses (no `details` leak), and made URL parsing scheme-aware.
  - AGENTS.md — documented the TLS env vars and local-dev fallback behavior.
- Verification Steps:
  1) Start without TLS vars: `node server/index.mjs` and hit `GET /health` — server listens on `http://localhost:4292` and logs a TLS warning.
  2) Start with `UXBIBLIO_TLS_KEY_PATH` and `UXBIBLIO_TLS_CERT_PATH` pointing to valid files — server listens on `https://localhost:4292`.
  3) POST invalid JSON to `/api/analyze/figma` — response status 400 includes `{ error }` only (no `details`).
  4) Set an invalid `OPENAI_API_KEY` and POST a valid request — non-2xx response includes `{ error, status }` without upstream body leakage.

## 2025-10-13 — Restore skeleton placeholders on repeat analysis

- Time: 2025-10-13T14:17:38Z
- Summary: Ensured non-palette tabs swap to the analyzing skeleton between runs so users don’t see stale insights while new results process; kept the door open for the Color Palette tab to surface live updates.
- Root Cause: `AnalysisTabsLayout` returned the previously rendered tab body whenever `hasContent` was true, bypassing the skeleton during analyzing/cancelling states.
- Changes:
  - ui/src/components/layout/AnalysisTabsLayout.tsx — gated live rendering to the color palette tab and always return the skeleton for other tabs while analyzing or cancelling.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/App.second-analysis-reset.spec.tsx`

## 2025-10-13 — Progress overlay renders instantly with cached content parked

- Time: 2025-10-13T15:42:00Z
- Summary: Reworked the analysis panel to mount a dedicated stage wrapper so the global progress skeleton appears immediately and stale insight DOM stays inert instead of blocking paints.
- Root Cause: Switching to the skeleton replaced entire tab subtrees; React diffed thousands of nodes before the commit, delaying the progress indicator and re-exposing interactive elements during analysis.
- Changes:
  - ui/src/components/layout/AnalysisTabsLayout.tsx — introduced `TabPanelStage`, cached settled tab bodies, added skeleton-overlay logging, and marked stale content as `data-panel-inert` with the `inert` attribute.
  - ui/src/styles.css — added `.analysis-tab-stage*` styles so cached content is visually hidden yet retained for diff stability.
  - ui/src/__tests__/App.progress-immediate.spec.tsx — RED/green regression coverage for second-run skeleton behaviour and first-run indeterminate progress.
  - ui/src/__tests__/App.progress-stage-transitions.spec.tsx — ensured stage state toggles clear `aria-hidden`/`data-panel-inert` after each run.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/App.progress-immediate.spec.tsx`
  2) `npx vitest run ui/src/__tests__/App.progress-stage-transitions.spec.tsx`

## 2025-10-13 — Sidebar sticky positioning restored with viewport-aware layout clamp

- Time: 2025-10-13T17:05:00Z
- Summary: Re-enabled the analysis sidebar to remain fixed while the content column scrolls by removing the overflow clip on the page container and constraining both columns to the viewport height with measured offsets.
- Root Cause: `main.content` (`ui/src/styles.css`) forced `overflow: hidden`, so the sticky nav never latched, and the analysis panel wasn't height-limited, causing the whole app to scroll instead of the panel.
- Changes:
  - ui/src/styles.css — let `.content` expose vertical overflow, introduced `--analysis-sticky-*` CSS vars, clamped `.analysis-navigation`/`.analysis-panel` to the viewport, and kept the mobile fallback static.
  - ui/src/components/layout/AnalysisTabsLayout.tsx — added sticky diagnostics logging, tracked ancestor overflow, and used `ResizeObserver` to update the CSS vars for banner/header offsets.
- Verification Steps:
  1) Load the plugin, trigger enough analysis output to overflow the panel, and confirm the left sidebar stays fixed while the right column scrolls.
  2) Toggle the notice banner or resize the plugin window and verify the sidebar and panel recompute their heights without introducing a second scrollbar.

## 2025-10-13 — Subscription banner aligned to shell header with squared corners

- Time: 2025-10-13T17:26:00Z
- Summary: Moved the quota banner to the very top of the plugin shell and removed its rounded corners so it spans the header edge-to-edge as designed.
- Root Cause: The banner was rendered inside the analysis grid, placing it below the search tools and inheriting card-style radii.
- Changes:
  - ui/src/App.tsx — render the banner ahead of the shell header, only when the analysis section is active.
  - ui/src/components/layout/AnalysisTabsLayout.tsx — drop the in-grid banner markup and keep the resize observer aware of the relocated element.
  - ui/src/styles.css — zero out the banner border radius so it no longer pulls card styling.
- Verification Steps:
  1) Switch to the Analysis view and confirm the quota banner appears above the navigation header with square corners.
  2) Toggle to Settings and back to ensure the banner hides and reappears without layout jumps.

## 2025-10-13 — Shell header & search stay pinned with the sidebar

- Time: 2025-10-13T17:44:00Z
- Summary: Locked the primary navigation header and search filter to the top of the plugin so they remain visible while scrolling analysis content, matching the sticky sidebar behaviour.
- Root Cause: Both components were in normal document flow, so scrolling the main shell displaced them even though the sidebar was pinned.
- Changes:
  - ui/src/App.tsx — wrapped the banner, header, and search bar in a sticky `analysis-shell-preamble` container rendered ahead of the analysis grid.
  - ui/src/styles.css — styled the new container to stick to the viewport, share the shell background, and fall back to static positioning on narrow screens.
  - ui/src/components/layout/AnalysisTabsLayout.tsx — observed the preamble for resize events so sidebar offsets stay in sync with the fixed header stack.
- Verification Steps:
  1) Scroll the Analysis view and confirm the banner, navigation, and search bar remain pinned while the panel content scrolls.
  2) Resize the plugin window or toggle the banner and verify the sidebar still aligns with the fixed header without popping a second scrollbar.

## 2025-10-13 — Align Impact tab styling with other analysis cards

- Time: 2025-10-13T19:40:00Z
- Summary: Gave the Impact tab the same elevated card treatment as the summary/copy tabs, parsed guardrail strings into proper next-step bullets, and flattened the banner chrome so the shell matches the latest comps.
- Root Cause: Impact reused the generic `AccordionSection`, which renders a bare surface and surfaces raw `Guardrail Recommendations` text instead of styled callouts, resulting in a flatter presentation than the other analysis cards.
- Changes:
  - ui/src/components/ImpactCard.tsx — introduced a dedicated card wrapper that formats impact summaries and recommendations, strips guardrail labels, and falls back to an empty-state message.
  - ui/src/app/buildAnalysisTabs.tsx — swapped the Impact tab renderer to the new card component.
  - ui/src/styles.css — added `.impact-card*` rules for the elevated background, spacing, and bullet styling so Impact matches our established card chrome and removed the banner corner radius to reflect the flat-top treatment.
- Verification Steps:
  1) Run an analysis with impact results and confirm the Impact tab shows the new elevated card with “Next Steps” bullets instead of uppercase guardrail text.
  2) Trigger an analysis without impact content and ensure the tab falls back to the existing empty-state copy.

## 2025-10-13 — Recommendation parsing matches web/extension sanitizers

- Time: 2025-10-13T21:50:00Z
- Summary: Mirrored the updated parser so plugin recommendations strip bracket metadata, preserve WCAG refs, and expose the recommendations accordion as a labelled region for accessibility.
- Root Cause: The plugin never stripped `[impact:...][Refs: ...]` annotations and rendered them verbatim; nested brackets also caused badge text to show heuristics snippets that the web UI dropped.
- Changes:
  - ui/src/utils/analysis/recommendations.ts — added depth-aware bracket stripping, footer extraction, and shared `sanitizeRecommendationText` helper; normalized merged recommendation collections through the sanitizer.
  - ui/src/components/RecommendationsAccordion.tsx — partition entries using the sanitizer, expose a `role="region"` landmark, and keep priority/immediate markers clean.
  - ui/src/__tests__/utils/recommendations.parser.spec.tsx — regression coverage for nested refs
  - ui/src/__tests__/components/RecommendationsAccordion.a11y.spec.tsx — a11y contract ensuring the region stops leaking metadata.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/utils/recommendations.parser.spec.tsx`
  2) `npx vitest run ui/src/__tests__/components/RecommendationsAccordion.a11y.spec.tsx`

## 2025-10-15 — Severity badges show score only

- Time: 2025-10-15T22:10:00Z
- Summary: Trimmed severity badges to display only the numeric score while keeping color semantics so users aren’t confused by redundant “Low” labels.
- Root Cause: Badge renderer concatenated severity and score, yielding strings like “Low · 4/5” that contradicted stakeholder expectations.
- Changes:
  - ui/src/components/SeverityBadge.tsx — removed severity text from the badge body, preserved tooltip context, and kept score-driven color logic intact.
- Verification Steps:
  1) Load any analysis card with severity + score and confirm the badge reads `4/5` while tooltip still references the severity label.

## 2025-10-15 — Guard analysis requests against missing global fetch

- Time: 2025-10-15T01:56:32Z
- Summary: Hardened the analysis request helper so plugin builds fall back to whichever global `fetch` is available, preventing the main thread from crashing before sending requests.
- Root Cause: `sendAnalysisRequest` dereferenced `globalThis.fetch`; the Figma plugin runtime exposes `fetch` globally but leaves `globalThis` undefined, so reading `.fetch` threw a TypeError before we could surface a friendly error.
- Changes:
  - src/utils/analysis.ts — added `resolveFetchImplementation` to safely detect `fetch` across `fetch`, `globalThis`, `self`, and `window` without tripping legacy runtimes.
  - tests/analysis-utils.test.ts — regression coverage proving the helper falls back to the ambient global fetch when no override is passed.
- Verification Steps:
  1) `npm run test -- tests/analysis-utils.test.ts`

## 2025-10-15 — Structured analysis fallback logged undefined variable

- Time: 2025-10-15T02:40:51Z
- Summary: Removed a stale comparison that referenced an undefined `structured` sentinel, which was crashing the local analysis server before it could return results.
- Root Cause: Earlier refactor intended to log whether the parsed response matched the structured payload, but the follow-up rename never updated a guard block, leaving `structured` undefined inside `handleAnalyzeRequest`.
- Changes:
  - server/index.mjs — dropped the redundant `analysis === structured` check so the handler only relies on the validated `parsedAnalysis` snapshot.
- Verification Steps:
  1) Send a local `/api/analyze/figma` request (e.g., trigger an analysis from the plugin) and confirm the server responds with JSON instead of a 500 error.

## 2025-10-16 — Consolidate analysis progress + runtime orchestration

- Time: 2025-10-16T18:05:00Z
- Summary: Pulled the analysis progress timer and duration history into dedicated utilities and moved plugin-side orchestration into a reusable runtime so UI and main threads no longer duplicate cache/abort logic; tightened CSS tokens to keep search controls + progress skeletons DRY.
- Root Cause: `ui/src/App.tsx` and `src/main.ts` each reimplemented timing, caching, and cancellation helpers, pushing both files past lint thresholds and creating drift (e.g., progress resets missing in some branches).
- Changes:
  - ui/src/utils/analysisHistory.ts, ui/src/hooks/useAnalysisProgress.ts, ui/src/App.tsx — centralized ETA math, timer lifecycle, and progress resets while keeping the global indicator behaviour unchanged.
  - src/runtime/analysisRuntime.ts, src/main.ts — extracted selection sync, cache validation, cancellation, and ping handling into a shared runtime surface.
  - tests/ui/app-progress-history.test.tsx, tests/ui/styles/styles-contract.test.ts, tests/runtime/main/plugin-runtime.contract.test.ts — new characterization + contract coverage to lock UI ↔ runtime messaging and CSS tokens.
  - ui/src/styles.css — grouped search control sizing + progress widths under shared tokens to eliminate duplicated declarations.
- Verification Steps:
  1) `npx vitest --run tests/runtime/main/plugin-runtime.contract.test.ts`
  2) `npx vitest --run tests/ui/app-progress-history.test.tsx ui/src/__tests__/App.progress-indicator.spec.tsx`
  3) `npx vitest --run tests/ui/styles/styles-contract.test.ts`

## 2025-10-20 — Analysis panel scroll restores after banner + mobile overflow fixes

- Time: 2025-10-20T16:35:00Z
- Summary: Ensured the analysis panel recomputes sticky metrics when the status banner appears and kept the panel scrollable on ≤320 px viewports; added targeted regression tests covering banner-driven reflow and ResizeObserver fallbacks.
- Root Cause: The sticky sidebar effect never observed the status banner (so cached `--analysis-sticky-available-height` values persisted) and the compact viewport media query set `.analysis-panel { overflow: visible; }`, eliminating in-panel scrolling.
- Changes:
  - ui/src/App.tsx — wrapped `StatusBanner` in a `role="banner"` header and passed a `hasStatusBanner` flag to the layout.
  - ui/src/components/layout/AnalysisTabsLayout.tsx — observed the status banner in the sticky metrics effect, refreshed calculations when banner state toggles (even without `ResizeObserver`), and expanded diagnostics to log banner visibility.
  - ui/src/styles.css — preserved `overflow-y: auto` for `.analysis-panel` in narrow breakpoints and added the banner landmark style hook.
  - ui/src/components/SearchBar.tsx — aligned tooltip text with live button labels to avoid stale copy while analyzing.
  - ui/src/__tests__/App.banner-scroll-recalculation.spec.tsx, ui/src/__tests__/App.banner-scroll-no-resizeobserver.spec.tsx, ui/src/__tests__/App.banner-scroll-narrow-width.spec.tsx — regression coverage for banner reflow, ResizeObserver absence, and compact viewport overflow.
- Verification Steps:
  1) `npx vitest run ui/src/__tests__/App.banner-scroll-recalculation.spec.tsx`
  2) `npx vitest run ui/src/__tests__/App.banner-scroll-no-resizeobserver.spec.tsx`
  3) `npx vitest run ui/src/__tests__/App.banner-scroll-narrow-width.spec.tsx`

## 2025-10-23 — Structured analysis cache treated populated payloads as empty

- Time: 2025-10-23T05:36:00Z
- Summary: Prevented the plugin runtime from discarding analysis responses that delivered insights via keyed objects (impact/recommendations/heuristics) and ensured recommendation priority tags survive colon metadata; tightened heuristics tab gating so placeholder rows no longer render as empty cards.
- Root Cause: `isStructurallyEmptyAnalysis` only looked for arrays or plain text, so object-wrapped sections were treated as empty during cache writes/reads. In parallel, the recommendation sanitiser stripped bracket tags containing colons, and the tab builder assumed any heuristics array (including canonical placeholders) implied renderable content.
- Changes:
  - src/runtime/analysisRuntime.ts — taught the structural emptiness check to detect meaningful object collections (with cycle guards) and reported object cardinality in summary stats.
  - ui/src/utils/analysis/recommendations.ts — preserved recognized priority brackets (`[Immediate: …]`, `[Long-term: …]`) instead of dropping them, emitting canonical tags while retaining severity notes.
  - ui/src/components/RecommendationsAccordion.tsx — relaxed bucket detection to accept colon-tagged brackets when partitioning copy guidance.
  - ui/src/app/buildAnalysisTabs.tsx — gated the heuristics tab on items with descriptions/severity/score so placeholder-only arrays produce an empty-state instead of a blank accordion.
  - tests/runtime/analysis-runtime.cache.test.ts, ui/src/__tests__/normalizers/analysis.recommendations-priority.spec.tsx, ui/src/__tests__/app.buildAnalysisTabs.heuristics-empty.spec.tsx — regression coverage for cache reuse, priority tag sanitisation, and heuristics tab gating.
- Verification Steps:
  1) `npx vitest run tests/runtime/analysis-runtime.cache.test.ts`
  2) `npx vitest run ui/src/__tests__/normalizers/analysis.recommendations-priority.spec.tsx`
  3) `npx vitest run ui/src/__tests__/app.buildAnalysisTabs.heuristics-empty.spec.tsx`

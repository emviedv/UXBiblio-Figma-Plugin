# App.tsx Refactor — UI Orchestration Split (2025-10)

Repo: `/Users/emily/Products/UXBiblio Figma-Plugin`

Goals
- Clean working code with no UI/behavior changes
- Remove duplication and centralize utilities (DRY)
- Keep implementation simple (KISS) and avoid speculative hooks (YAGNI)
- Improve testability and enforce a11y contracts

Summary of Changes
- Extracted utils
  - `ui/src/utils/classNames.ts`: shared class joiner
  - `ui/src/utils/strings.ts`: OBS token sanitizers
  - `ui/src/utils/url.ts`: endpoint formatter
  - `ui/src/utils/analysis.ts`: all analysis normalization + types
  - `ui/src/utils/color.ts`: palette math + color conversions
- Split presentational components
  - Cards/accordions/icons into `ui/src/components/**`
  - Tabs layout into `ui/src/components/layout/AnalysisTabsLayout.tsx`
  - Controls into `ui/src/components/controls/AnalysisControls.tsx`
  - Color palette into `ui/src/components/ColorPalette.tsx`
  - Shared type `ui/src/types/analysis-tabs.ts`
- Simplified `ui/src/App.tsx`
  - Orchestration only (state, effects, plugin messages, tab definitions)
  - Removed old in-file duplications and commented legacy blocks

Tests (Characterization)
- Added: `ui/src/__tests__/App.*.spec.tsx` to lock existing behavior
  - a11y: tablist/tabpanels roles/aria
  - status banners: error focus; success auto-dismiss (E2E-leaning)
  - analyze button guards and busy state

Verification
- `npx vitest run ui/src/__tests__/*.spec.tsx` — all pass
- No UI text/ARIA changes; no new dependencies/config

Notes for Future
- Keep App.tsx focused on orchestration; add new UI in components/**
- Keep pure transforms in utils/**; add unit tests there if they evolve


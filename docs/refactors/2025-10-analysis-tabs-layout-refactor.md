# 2025-10 Analysis Tabs Layout Refactor

- **Scope**: `ui/src/components/layout/AnalysisTabsLayout.tsx` plus supporting tests in `ui/src/__tests__/layout/`
- **Repo**: `/Users/emily/Products/UXBiblio Figma-Plugin`
- **Status**: Completed (2025-10-14)

## Intent
- Remove duplicated skeleton messaging logic and consolidate `TabPanelStage` handling without altering UI or analysis flows.
- Preserve ES2017 output constraints and existing logging hooks.
- Improve readability/maintainability ahead of upcoming progress-indicator work.

## Key Changes
- Introduced `buildSkeletonMessage` and `renderPanelStage` helpers to DRY message assembly and tab-stage rendering.
- Normalized a single exit path inside `renderTabBody`, ensuring cached content, skeleton overlays, and success/idle states use shared logic.
- Added characterization and contract tests to lock current behavior prior to refactor.

## Verification
- `npx vitest run ui/src/__tests__/layout/AnalysisTabsLayout.characterization.spec.tsx`
- `npx vitest run ui/src/__tests__/layout/AnalysisTabsLayout.contract.spec.tsx`

No production endpoints were hit; work limited to local/staging expectations (`UXBIBLIO_ANALYSIS_URL` unchanged).

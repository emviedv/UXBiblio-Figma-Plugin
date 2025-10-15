# Analysis Utilities Refactor — Normalization Pipeline (2025-10)

Repo: `/Users/emily/Products/UXBiblio Figma-Plugin`

Goals
- Clean working code with no UI/output regressions (Applying DRY, YAGNI, KISS).
- Remove duplication across normalization helpers and make defaults reusable.
- Lock existing behavior via characterization + contract tests before refactor.

Summary of Changes
- Split the legacy 1k-line `ui/src/utils/analysis.ts` into focused modules under `ui/src/utils/analysis/` (`accessibility.ts`, `heuristics.ts`, `psychology.ts`, `impact.ts`, `sources.ts`, `strings.ts`, etc.) so each concern handles parsing for its section.
- Rewrote the orchestration layer in `ui/src/utils/analysis.ts` to compose those helpers, centralize defaults with `createEmptyAnalysis()`, and add `asRecord`/`normalizePipelineReceipts` guards that keep inputs defensive without branching explosions.
- Updated `normalizeCopywriting` to share a single base initializer, reuse shared string helpers, and rely on the new receipts dedupe flow.
- Added iterative OBS token counting to avoid recursive depth limits and minimize function complexity.

Tests (Characterization & Contracts)
- `ui/src/__tests__/normalizers/normalizeAnalysis.defaults-and-obs.spec.tsx`
- `ui/src/__tests__/normalizers/analysis.normalize-confidence.contract.spec.tsx`
- `ui/src/__tests__/normalizers/analysis.extract-analysis-data.contract.spec.tsx`
- Existing normalizer suites under `ui/src/__tests__/normalizers/*.spec.tsx`

Verification
- `npx vitest run ui/src/__tests__/normalizers`

Notes for Future
- Keep new helpers in `ui/src/utils/analysis/` self-contained; add contract tests alongside whenever section schemas evolve.
- `ui/src/utils/analysis.ts` should stay focused on orchestration + shared defaults; avoid reintroducing section-specific parsing here.

# ✅ PRD — UXBiblio Figma Widget (v0.1)

**Product:** UXBiblio  
**Type:** Figma Widget  
**Version:** v0.1  
**Status:** Discovery — Ready for Engineering Review  
**Owner:** Emily Veras  
**Repo:** `/Users/emily/Products/UXBiblio Figma-Plugin`  
**Last Updated:** 2025-10-18

---

## 1. Problem

Design teams love the UXBiblio Figma plugin, but a growing subset wants persistent, canvas-native insights that stay visible while collaborating. Plugins close as soon as users click outside the modal, making it hard to keep analysis context alongside the flow that triggered it. We need a widget version that preserves all plugin insights, respects existing guardrails, and delivers a simplified, single-page accordion UI so teams can pin results directly on the canvas without interrupting handoff.

**Goal:** Ship a widget that matches the plugin’s feature coverage on day one, while keeping the current plugin untouched.

---

## 2. Success Criteria

| Goal | Metric |
| ---- | ------ |
| Full feature parity | Widget supports the same five-frame cap, credit gating, analysis normalization, and upgrade/auth flows as the plugin. |
| Canvas persistence | Analysis results remain visible after deselecting the widget; collaborators see the latest output without reopening UI. |
| ES2017 compliance | Builds pass the existing compatibility checker; widget bundles stay within the current `es2017` baseline. |
| No regressions to plugin | Existing plugin manifest, build scripts, and UI remain unmodified; plugin users experience zero changes. |

---

## 3. Scope & Feature Set (Day-One Parity)

| Area | Requirements |
| ---- | ------------ |
| **Selection & Export** | Reuse runtime export rules: up to five frames/groups per run, multi-frame warning, identical base64 export quality, same error copy (`NO_SELECTION_ERROR`, `CREDITS_EXHAUSTED_ERROR`). |
| **Analysis Request Pipeline** | Keep `createAnalysisRuntime` logic (or refactor shared core) so widget posts to `UXBIBLIO_ANALYSIS_URL` (default `http://localhost:3115`) and logs via `debugService`. Respect credit decrement timing and cancellation semantics. |
| **UI Presentation** | Replace plugin tabs with a single-page layout containing stacked accordions: Summary, Heuristics, Accessibility, Psychology, Impact, Recommendations, Flow, Industries, and Receipts. Accordions show skeleton states following `data-skeleton="true"` and embed the global progress indicator. |
| **Recommendations Meta Chips** | Display Impact/Effort/Refs chips inside the accordion content; no colonised metadata strings. |
| **Account & Credits** | Surface the same banner copy + tooltip conventions. Widget shows credit status above accordions and disables Analyze when blocked. |
| **Analytics Guardrails** | Keep default targeting to staging/local endpoints; production URLs only for intentional verification. Honor `UXBIBLIO_DEBUG_LOGS`. |
| **Auth & Upgrade** | Provide sign-in and upgrade CTAs consistent with plugin copy; open external URLs via widget actions (`figma.showUI` not available, so use `figma.ui.openExternalAsync` once approved). |

Out of scope: widget-only experiments (e.g., sticky notes, annotation layers), new visual chrome removals (respect the existing card borders and dividers), production manifest changes, or pipeline consolidation.

---

## 4. User Flow (Widget)

```
Insert UXBiblio Widget →
  Select eligible frames (<=5) →
    Click “Analyze Flow (n)” in widget →
      Run analysis (progress bar + ETA in accordions) →
        View persistent results (accordion cards) →
          Re-run or share with team
```

Edge cases:

- Selecting more than five frames disables the analyze button and surfaces the limit warning.  
- Credits exhausted triggers CTA and keeps the widget visible with last successful results.  
- Failed analyses retain previous results and show the non-blocking error banner inline.

---

## 5. UI & Interaction Model

| Section | Behavior |
| ------- | -------- |
| **Header** | Widget title, frame selection summary, Analyze/Cancel button that updates copy (`Analyze Flow (n)`, `Cancel Analysis`). |
| **Status Banner** | Mirrors plugin messaging (signed-in status, upgrade prompts). Remains at top of content stack. |
| **Global Progress Indicator** | Renders above accordion list during analysis with shared styling (`.global-progress*` classes). Indeterminate mode removes ETA label when history is empty. |
| **Accordions** | Collapsible sections that default to expanded on first load; each includes skeleton placeholders when data pending. Frame icon appears in empty/skeleton states via `Frame` from `lucide-react`. |
| **Actions Row** | Copy to clipboard, export JSON, and sign-in/upgrade controls exposed via button chips under the accordion list. |

Corner radius, spacing, type scale, titles/labels, and badge styles must match the 2025-03-09 token guidelines, with adjustments noted in the Assistant Notes.

---

## 6. Technical Architecture

### 6.1 Bundling & Manifest

- New manifest: `manifest.widget.json` with `"widgetApi": "1.0.0"`, `"main": "widget/dist/main.js"`, no `ui` entry.  
- New build script: `npm run build:widget` (Vite or esbuild) targeting ES2017, output to `widget/dist/`.  
- Packaging: `npm run package:widget` creates `submission/widget/` assets and zip (e.g., `uxbiblio-figma-widget.zip`).  
- CI: extend `scripts/run-test-ci.ts` once widget lint/tests exist; update `AGENTS.md` when scripts land (per guardrail).

### 6.2 Code Organization

- Create `widget/` workspace:  
  - `widget/src/main.tsx`: registers widget with `figma.widget.register` and manages selection state via `useSyncedState`.  
  - `widget/src/runtime/` reuses shared analysis runtime core (extract shared logic into `/shared/` to avoid duplication).  
  - `widget/src/components/Accordion.tsx`, `ProgressBar.tsx`, etc., using widget AutoLayout primitives.  
- Shared modules (`src/utils/analysis`, `src/runtime/analysisRuntime.ts`, logger) exposed via a new shared entry (e.g., `shared/analysisRuntime.ts`). Refactor carefully to avoid regressions (plugin imports must resolve unchanged).  
- Widget-specific hooks to mirror plugin lifecycle (`useWidgetSelection`, `useAnalysisLifecycleWidget`).  
- Ensure `UXBIBLIO_DEBUG_LOGS` toggle propagates to widget runtime.

### 6.3 Data & State

- Synced fields: latest analysis payload, credits state, selection metadata, progress history (median of last 10 runs stored in widget `clientStorage`).  
- Local storage key parity with plugin for ETA history to maintain consistent predictions.  
- Cancel action aborts current fetch (reuse `AbortController`) and restores previous data.

### 6.4 Security & Networking

- Default endpoints: `UXBIBLIO_ANALYSIS_URL=http://localhost:3115`, `UXBIBLIO_ANALYSIS_UPSTREAM_URL` optional for proxy bridging.  
- TLS support: respect `UXBIBLIO_TLS_KEY_PATH`/`UXBIBLIO_TLS_CERT_PATH` when widget triggers local server (documented in README).  
- Handle CSRF-protected upstreams via existing proxy flow (reuse headers and `X-UXBiblio-Proxy-Session` logic).

---

## 7. Risks & Mitigations

| Risk | Mitigation |
| ---- | ---------- |
| **Parallel architecture drift** | Extract shared runtime utilities to `/shared` before widget-specific code; add unit tests covering plugin + widget imports. |
| **Widget UI complexity** | Start with auto-layout accordions; defer advanced chrome until after parity review. Validate with design before styling tweaks (per guardrails). |
| **State persistence bugs** | Instrument additional `logger.debug` calls around widget selection syncing and analysis caching (Applying Debug Log Policy). |
| **Long-Term Viability** | Ensure widget project mirrors plugin’s maintainability; document all new scripts/config in `AGENTS.md` during implementation (Applying Long-Term Viability Check). |

---

## 8. Testing Plan

| Test Case | Expected Outcome |
| --------- | ---------------- |
| Insert widget with no selection | Widget prompts to select frames; Analyze disabled, tooltip shows quota copy. |
| Select >5 frames | Analyze disabled, warning banner visible until selection trimmed. |
| Successful multi-frame run | Progress indicator runs with ETA, analysis renders across all accordions, credits decrement per frame. |
| Cancel mid-run | Abort controller cancels request; widget reverts to idle state without losing previous results. |
| Credits exhausted | Banner + button state match plugin behaviour; upgrade CTA fires `openExternal` fallback when OS blocks. |
| Debug logs off | Running `UXBIBLIO_DEBUG_LOGS=false npm run build:widget` removes `[AnalysisNormalizer][Delta]` entries. |

Manual verification: confirm widget bundle loads in Figma desktop, functions alongside plugin without shared state collisions, and respects port guardrails (preserve 3115).

---

## 9. Open Questions

1. Do we expose widget + plugin in a single community release or ship widget as a separate listing?  
2. Should widget auto-refresh on selection changes, or require explicit rerun to avoid unexpected credit spend?  
3. How do we communicate current credit balance when multiple widgets exist on a page? Consider shared status sync.

---

## 10. Timeline (Draft)

| Week | Milestone |
| ---- | --------- |
| Week 1 | Scaffold widget workspace, extract shared runtime modules, set up build + manifest. |
| Week 2 | Implement widget accordions, progress indicator, banner, and Analyze flow. |
| Week 3 | Integrate auth, credits, recommendations chips, and JSON export. Add tests + debug logs. |
| Week 4 | QA in Figma desktop + web, finalize documentation, prep community submission assets. |

---

## 11. Post-v0.1 Enhancements

- Shared analytics between widget and plugin (opt-in).  
- Canvas annotations highlighting specific UX issues.  
- Live sync between multiple widget instances.  
- Localization of widget copy.

---

## ✅ Launch Checklist (Widget)

* [ ] `manifest.widget.json` present, validated by Figma widget validator  
* [ ] `npm run build:widget` passes, outputs ES2017 bundle  
* [ ] `npm run package:widget` archives widget assets under `submission/widget/`  
* [ ] Widget + plugin function independently in staging builds  
* [ ] Debug log policy entries added to `docs/live-debug/LIVE_DEBUG_YYYY-MM.md` for widget issues/fixes  
* [ ] README updated with widget usage instructions after implementation (plugin section untouched)

---

Updating this PRD: ensure changes align with UX guardrails, respect analysis formatting rules, and record any new “should have been done” guidance in `/Users/emily/Products/UXBiblio Figma-Plugin/AGENTS.md`.

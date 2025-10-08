# ✅ MVP PRD — UXBiblio Figma Plugin (v0.1)

**Product:** UXBiblio  
**Type:** Figma Plugin  
**Version:** MVP v0.1  
**Status:** Ready for Build  
**Owner:** Emily Veras  
**Last Updated:** 2025-10-07

---

## 1. Problem

Designers often store UX inspiration, screenshots, and UI ideas across multiple tools, with no quick way to analyze design heuristics **directly inside Figma**.  
Currently, UXBiblio only supports uploads via Chrome extension or the web app, requiring designers to leave their workflow.

**Goal:** Provide instant, in-context UX analysis inside Figma — no switching, no logins.

---

## 2. Goals

| Goal                                  | Success Metric                               |
| ------------------------------------- | -------------------------------------------- |
| Analyze a selected frame or component | AI returns results successfully              |
| Display results directly in plugin    | >95% of analyses load without needing reload |
| Stay fully local (no auth flow)       | Zero friction; immediate usability           |
| Keep plugin response time low         | Under 7 seconds for average analysis         |

---

## 3. Core Features (MVP Scope)

| Feature                        | Description                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| **Analyze Frame or Selection** | Runs AI UX heuristics analysis on a selected Figma frame or group.                   |
| **Inline UX Analysis Results** | Displays collapsible result sections: Heuristics, Accessibility, Psychology, Impact. |
| **Color Palette Extraction**   | Detects and lists all primary colors used in the frame.                              |
| **Smart Recommendations**      | Displays 2–3 AI suggestions for UX improvements.                                     |
| **Local Save (Optional)**      | Allows users to export results as JSON to desktop.                                   |

---

## 4. User Flow

```
Open Plugin →
  Select Frame →
    Click “Analyze Selection” →
      View AI Results →
        (Optional) Export JSON
```

---

## 5. UI Layout

| Section           | Elements                                                           |
| ----------------- | ------------------------------------------------------------------ |
| **Header**        | Plugin name, Analyze button                                        |
| **Results Area**  | Accordion with tabs: Heuristics, Accessibility, Psychology, Impact |
| **Color Palette** | Auto-extracted swatches with hex codes                             |
| **Footer**        | Export JSON button + link to UXBiblio.com                          |

---

## 6. Technical Architecture

### Frontend

* Figma Plugin UI: React + Vite
* Styling: Tailwind or minimal inline CSS

### Backend

* API Endpoint: `POST /api/analyze/figma`
* Payload:

```json
{
  "image": "<base64>",
  "source": "figma-plugin",
  "selectionName": "Signup Modal"
}
```

* No authentication required (analysis endpoint open to free tier with rate limiting)

---

## 7. Out of Scope

* Multi-frame batch analysis
* UXBiblio account sync
* Collections or project tagging
* Commenting or annotations
* Real-time design comparison

---

## 8. Test Plan

| Test Case                        | Expected Result               |
| -------------------------------- | ----------------------------- |
| Frame selected + analyze clicked | Returns valid analysis        |
| No selection                     | Displays error message        |
| Long frame (large size)          | Warns about potential delay   |
| Export results                   | JSON downloaded successfully  |
| API timeout                      | Graceful error fallback shown |

---

## 9. UI Copy (Refined, No Emojis)

| Element              | Copy                                                            |
| -------------------- | --------------------------------------------------------------- |
| Empty State          | “Select a Frame to begin analysis.”                             |
| Analyze Button       | “Analyze Selection”                                             |
| Export Button        | “Export Results”                                                |
| No Selection Tooltip | “Please select a Frame or Group before analyzing.”              |
| Timeout Message      | “Analysis took too long. Try again or simplify your selection.” |

---

## 10. Plugin Manifest (Figma v3)

```json
{
  "name": "UXBiblio Analyzer",
  "id": "uxbiblio-analyzer",
  "editorType": ["figma"],
  "main": "main.ts",
  "ui": "ui.html"
}
```

---

## 11. Post-MVP Opportunities

* Auto-save to UXBiblio library (once auth reinstated)
* Bulk page analysis
* AI-driven score comparison
* Accessibility color overlay
* Team sharing and reports

---

## ✅ MVP Launch Checklist

* [x] Analyze single frame via AI
* [x] Inline heuristic results view
* [x] Color extraction
* [x] Export as JSON
* [x] No login or signup friction

---

## 12. Test-Driven Development Roadmap

### UI Spacing & Card Layout Refactor (2025-10)

- Introduced a shared `CardSection` wrapper in the React UI so all inner card slabs (summary, guidance, accessibility, recommendations, palette) inherit identical padding, title styling, and optional action slots (e.g., severity badges).
- Consolidated CSS into a single `.card-section` class with supporting `.card-section-header` / `.card-section-actions` utilities to enforce a 14 px outer gutter and consistent 12 px stack gap.
- Palette swatches now reuse the same section wrapper, keeping the existing borders while aligning with the card spacing system.
- Added Vitest + RTL characterization suites (`tests/ui/cards-layout.test.tsx`, updates to `tests/ui/app.test.tsx`) to lock accessibility semantics, ARIA roles, and copy interactions before refactoring.
- When adding new card content, compose with `<CardSection title="…">` to avoid reintroducing bespoke padding or header markup.

Each phase toward the MVP should begin with a failing test (or red outcome in manual verification notes), implement the minimal code to pass, then refactor. The following TDD playbooks outline scope, tooling, and pass criteria.

### Phase 1 — Architecture & Data Parity

**Objective:** Prove the plugin integrates cleanly with the analysis API, generates deterministic exports, and normalizes all data structures.

- **Environment & Tooling**
  - Run plugin against the local AI server (`UXBIBLIO_ANALYSIS_URL=http://localhost:4119`) seeded with staged fixtures.
  - Use Vitest or Jest + `@figma/plugin-typings` stubs for unit coverage; employ MSW (Mock Service Worker) to simulate API responses.
  - Add lint/type checks (`npm run typecheck`) to CI gate.
- **Test Matrix**
  - `extractSolidFillHexes` returns deduplicated HEX swatches for nested frames; ignores invisible or non-solid fills.
  - Selection export routine encodes PNG snapshots at `SCALE=2` and throws a descriptive error when `exportAsync` fails.
  - API client posts payload `{image, selectionName, source}` and retries gracefully on 429 (respecting rate-limit headers).
  - `normalizeAnalysis` maps partial payloads to default structures (empty arrays) without runtime errors.
  - `ANALYSIS_BASE_URL` helper selects staging/prod endpoints based on `UXBIBLIO_ANALYSIS_URL`, trimming trailing slashes.
- **Definition of Done**
  - All new tests green; coverage threshold ≥80% on `src/main.ts` logic helpers.
  - TypeScript build clean, no `any` introduced.
  - Dev notes logged documenting fixtures and mock strategies.

### Phase 2 — UX Polish & Resilience

**Objective:** Validate end-user flows inside Figma and ensure resilient UI states for error conditions, long-running analyses, and accessibility.

- **Environment & Tooling**
  - Use Figma Desktop with the plugin loaded from `dist/`.
  - Capture UI regressions via Storybook/VRT (Chromatic or Playwright screenshot tests) where feasible.
  - Leverage React Testing Library + Jest DOM for component-level behavior.
- **Test Matrix**
  - UI disables Analyze button during in-flight requests; spinner copy (“Analyzing…”) renders, returns to idle after completion.
  - Empty state copy surfaces immediately when selection cleared; warnings banner appears for unsupported node types.
  - Error banner messaging changes based on timeout vs validation errors; expect focus management for accessibility.
  - Recommendations accordion renders each section when data present; hides cards when arrays empty.
  - JSON export produces a downloadable file with ISO timestamp, slugified filename, and payload echo.
  - Keyboard navigation (Tab order) reaches primary CTA and export button; colors meet WCAG AA contrast.
- **Definition of Done**
  - Manual QA checklist completed on macOS + Windows Figma clients.
  - No unresolved console warnings; UI tests cover primary state transitions.
  - Accessibility smoke test (axe-core or Lighthouse) returns no critical issues.

### Phase 3 — Release Readiness

**Objective:** Final verification on production endpoints, packaging, and handoff artifacts to support launch.

- **Environment & Tooling**
  - Build with production API (`UXBIBLIO_ANALYSIS_URL=https://api.uxbiblio.com`) and final manifest.
  - Execute smoke tests using a curated library of Figma frames (mobile, desktop, dark mode).
  - Use automated regression scripts (Playwright/browser automation) to replay core flow end-to-end.
- **Test Matrix**
  - Cross-verify analysis output parity between Figma plugin and Chrome extension for identical frames.
  - Observe network telemetry for latency ≤7 seconds average; log request IDs for traceability.
  - Validate packaging artifacts: `manifest.json`, `dist/main.js`, `dist/ui/index.html`, license/readme attachments.
  - Verify fallback UI (when UI bundle missing) still provides actionable instructions.
  - Ensure rate-limit or server errors surface to the user with recovery guidance.
- **Definition of Done**
  - All Phase 1 + Phase 2 tests remain green on the release build.
  - Sign-off sheet includes analytics impact assessment and roll-back plan.
  - Submission bundle archived with version tag, release notes, and screenshot set.

---

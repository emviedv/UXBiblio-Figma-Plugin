import { describe, expect, it } from "vitest";
import { readCssAggregate } from "./readCssAggregate";

const css = readCssAggregate("ui/src/styles.css");

describe("styles.css regressions", () => {
  it("keeps the shared button rule intact", () => {
    const match = css.match(
      /\.primary-button,\s*\n\.secondary-button,\s*\n\.tertiary-button\s*{[^}]+}/
    );
    expect(match).not.toBeNull();
    expect(match?.[0]).toContain("border-radius: var(--uxb-button-radius);");
    expect(match?.[0]).toContain("font-size: 12px;");
    expect(match?.[0]).toContain("display: inline-flex;");
  });

  it("preserves global progress styling for skeleton states", () => {
    expect(css).toContain(".global-progress-bar.is-indeterminate .global-progress-fill");
    expect(css).toContain(".global-progress-callout");
    expect(css).toContain(".analysis-tab-stage-skeleton");
  });

  it("exposes root design tokens used across cards and controls", () => {
    expect(css).toMatch(/:root\s*{[\s\S]*--uxb-card-radius-base:\s*8px;/);
    expect(css).toMatch(/:root\s*{[\s\S]*--uxb-button-gradient:\s*linear-gradient/);
    expect(css).toMatch(/:root\s*{[\s\S]*--uxb-type-body-md:\s*13px;/);
    expect(css).toMatch(/:root\s*{[\s\S]*--figma-color-bg:\s*#1f2933;/);
  });

  it("retains analysis grid layout primitives for responsive shell", () => {
    const gridRule = css.match(/\.analysis-grid\s*{[\s\S]*?}/);
    expect(gridRule).not.toBeNull();
    expect(gridRule?.[0]).toContain("display: grid");
    expect(gridRule?.[0]).toContain("grid-template-columns: repeat(12, minmax(0, 1fr))");
    expect(gridRule?.[0]).toContain("--analysis-sticky-offset: 0px");
    expect(css).toContain(".analysis-grid-banner");
    expect(css).toContain(".analysis-shell-preamble");
  });

  it("keeps skeleton scaffolding classes for tab placeholders intact", () => {
    expect(css).toContain(".tab-skeleton");
    expect(css).toContain(".tab-skeleton .skeleton-content");
    expect(css).toContain(".tab-skeleton .skeleton-line");
    expect(css).toContain(".tab-empty-title");
  });
});

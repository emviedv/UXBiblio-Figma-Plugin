import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "ui/src/styles.css"), "utf8");

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
});

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import App from "../App";

interface PluginMessageEvent {
  type: string;
  payload?: Record<string, unknown>;
}

function dispatchPluginMessage(message: PluginMessageEvent): void {
  window.dispatchEvent(new MessageEvent("message", { data: { pluginMessage: message } }));
}

describe("Analysis panel overflow in compact viewports", () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalInnerWidth: number;

  beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("Unexpected console.error during test run");
    });

    originalMatchMedia = window.matchMedia;
    originalInnerWidth = window.innerWidth;

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: /\(max-width:\s*320px\)/.test(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));

    Object.defineProperty(window, "innerWidth", { writable: true, value: 314 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, "innerWidth", { writable: true, value: originalInnerWidth });
  });

  it("keeps the analysis panel scrollable when viewport width is 320px or less", async () => {
    const { container } = render(<App />);

    await act(async () => {
      dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true } });
      dispatchPluginMessage({
        type: "ANALYSIS_RESULT",
        payload: {
          selectionName: "Compact View",
          analysis: {
            analysis: {
              heuristics: [
                { title: "First insight", description: "Ensure there is enough content to scroll." }
              ],
              impact: new Array(6).fill(null).map((_, index) => ({
                title: `Impact ${index + 1}`,
                description: "Tall card to enforce overflow."
              }))
            }
          }
        }
      });
    });

    const panel = await waitFor(() =>
      container.querySelector<HTMLElement>(".analysis-panel")
    );
    expect(panel).not.toBeNull();

    const stylesPath = resolve(dirname(fileURLToPath(import.meta.url)), "../styles.css");
    const stylesSource = readFileSync(stylesPath, "utf8");

    expect(stylesSource).toMatch(/@media\s*\(max-width:\s*320px\)[\s\S]*\.analysis-panel\s*{[^}]*overflow-y:\s*auto/i);
    expect(stylesSource).not.toMatch(/@media\s*\(max-width:\s*320px\)[\s\S]*\.analysis-panel\s*{[^}]*overflow\s*:\s*visible/i);
  });
});

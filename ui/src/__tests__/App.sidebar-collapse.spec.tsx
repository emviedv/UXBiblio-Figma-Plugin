import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../App";

describe("Sidebar collapse controls", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      throw new Error(`Unexpected console.error: ${args.join(" ")}`);
    });
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders a sidebar collapse toggle control", () => {
    render(<App />);
    const toggle = screen.getByRole("button", { name: /Collapse sidebar/i });
    expect(toggle).not.toBeNull();
  });

  it("collapses navigation and expands analysis panel area", async () => {
    const { container } = render(<App />);
    const toggle = screen.getByRole("button", { name: /Collapse sidebar/i });
    fireEvent.click(toggle);

    await waitFor(() => {
      const grid = container.querySelector(".analysis-grid");
      expect(grid?.getAttribute("data-sidebar-collapsed")).toBe("true");
    });
  });

  it("mirrors aria-expanded state with toggle interactions", () => {
    render(<App />);
    const toggle = screen.getByRole("button", { name: /Collapse sidebar/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("preserves tab accessible names for collapsed icon-only view", () => {
    render(<App />);
    const firstTab = screen.getByRole("tab", { name: "UX Summary" });
    expect(firstTab.getAttribute("aria-label")).toBe("UX Summary");
  });
});

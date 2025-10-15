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
    const toggle = screen.getByRole("button", { name: /Expand sidebar/i });
    expect(toggle).not.toBeNull();
  });

  it("toggles navigation width when expanding and collapsing", async () => {
    const { container } = render(<App />);
    const toggle = screen.getByRole("button", { name: /Expand sidebar/i });

    // Starts collapsed by default
    await waitFor(() => {
      const grid = container.querySelector(".analysis-grid");
      expect(grid?.getAttribute("data-sidebar-collapsed")).toBe("true");
    });

    fireEvent.click(toggle);

    await waitFor(() => {
      const grid = container.querySelector(".analysis-grid");
      expect(grid?.getAttribute("data-sidebar-collapsed")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: /Collapse sidebar/i }));
    await waitFor(() => {
      const grid = container.querySelector(".analysis-grid");
      expect(grid?.getAttribute("data-sidebar-collapsed")).toBe("true");
    });
  });

  it("mirrors aria-expanded state with toggle interactions", () => {
    render(<App />);
    const expandToggle = screen.getByRole("button", { name: /Expand sidebar/i });
    expect(expandToggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(expandToggle);
    const collapseToggle = screen.getByRole("button", { name: /Collapse sidebar/i });
    expect(collapseToggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(collapseToggle);
    expect(screen.getByRole("button", { name: /Expand sidebar/i }).getAttribute("aria-expanded")).toBe("false");
  });

  it("preserves tab accessible names for collapsed icon-only view", () => {
    render(<App />);
    const firstTab = screen.getByRole("tab", { name: "UX Summary" });
    expect(firstTab.getAttribute("aria-label")).toBe("UX Summary");
  });
});

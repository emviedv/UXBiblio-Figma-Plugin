import { afterEach, beforeEach, vi } from "vitest";

const originalConsoleError = console.error;
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation((...args: unknown[]) => originalConsoleError(...args));
});

afterEach(() => {
  const currentSpy = consoleErrorSpy;
  consoleErrorSpy = null;

  const calls = currentSpy?.mock.calls ?? [];
  currentSpy?.mockRestore();

  if (calls.length > 0) {
    const firstCall = calls[0];
    throw new Error(
      `Unexpected console.error during tests: ${firstCall
        .map((value) => {
          if (typeof value === "string") {
            return value;
          }
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        })
        .join(" ")}`
    );
  }
});

import { vi } from "vitest";
import { logger } from "@shared/utils/logger";

class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

type GlobalWithOptionalResizeObserver = typeof globalThis & {
  ResizeObserver?: typeof ResizeObserver;
};

export function setupAnalysisTabsLayoutTestEnv(): () => void {
  const globalWithResizeObserver = globalThis as GlobalWithOptionalResizeObserver;
  const originalResizeObserver = globalWithResizeObserver.ResizeObserver;

  vi.stubGlobal("ResizeObserver", MockResizeObserver);

  const debugSpy = vi.spyOn(logger, "debug").mockImplementation(() => undefined);
  const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

  return () => {
    debugSpy.mockRestore();
    warnSpy.mockRestore();

    if (originalResizeObserver) {
      vi.stubGlobal("ResizeObserver", originalResizeObserver);
      return;
    }

    delete globalWithResizeObserver.ResizeObserver;
  };
}

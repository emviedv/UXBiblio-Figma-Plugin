import type { PluginToUiMessage } from "@shared/types/messages";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import App from "../../ui/src/App";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

export function renderApp(): HTMLDivElement {
  cleanupApp();

  container = document.createElement("div");
  document.body.appendChild(container);

  root = createRoot(container);

  act(() => {
    root?.render(<App />);
  });

  return container;
}

export function cleanupApp(): void {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }

  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }

  root = null;
  container = null;
}

export function dispatchPluginMessage(message: PluginToUiMessage): void {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data: { pluginMessage: message } }));
  });
}

export async function dispatchPluginMessageAndFlush(message: PluginToUiMessage): Promise<void> {
  if (process?.env?.DEBUG_FIX === "1") {
    console.info("[DEBUG_FIX][TestHarness] Dispatch+flush plugin message", {
      type: message.type
    });
  }
  await act(async () => {
    window.dispatchEvent(new MessageEvent("message", { data: { pluginMessage: message } }));
    await Promise.resolve();
  });
  await tick();
}

export async function tick(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

export { act } from "react";

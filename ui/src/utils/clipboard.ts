import { logger } from "@shared/utils/logger";

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof text !== "string" || text.length === 0) {
    return false;
  }

  if (typeof navigator !== "undefined") {
    const clipboard = navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === "function") {
      try {
        await clipboard.writeText(text);
        return true;
      } catch (error) {
        logger.warn("[Clipboard] Clipboard API write failed", { error });
      }
    }
  }

  logger.warn("[Clipboard] Clipboard API unavailable; copy aborted", {
    hasNavigator: typeof navigator !== "undefined",
    hasClipboard: Boolean(typeof navigator !== "undefined" && navigator.clipboard)
  });
  return false;
}

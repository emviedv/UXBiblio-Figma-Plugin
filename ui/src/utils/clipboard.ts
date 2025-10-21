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

  if (typeof document === "undefined") {
    logger.warn("[Clipboard] Document context unavailable; copy aborted", {
      hasNavigator: typeof navigator !== "undefined"
    });
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.zIndex = "-1";

  document.body.appendChild(textarea);

  let succeeded = false;
  try {
    textarea.focus();
    textarea.select();
    succeeded = document.execCommand("copy");
  } catch (error) {
    logger.warn("[Clipboard] document.execCommand copy failed", { error });
    succeeded = false;
  } finally {
    document.body.removeChild(textarea);
  }

  return succeeded;
}

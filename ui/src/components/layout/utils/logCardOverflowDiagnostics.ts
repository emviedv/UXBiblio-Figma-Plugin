import { logger } from "@shared/utils/logger";
import type { AnalysisStatus } from "../../../types/analysis-status";

type CardOverflowLogParams = {
  panelElement: HTMLElement;
  activeTabId: string;
  status: AnalysisStatus;
  tabIdsKey: string;
  previousSignature?: string | null;
};

type CardOverflowEntry = {
  index: number;
  id: string | null;
  className: string;
  overflowX: string;
  overflowY: string;
};

export function logCardOverflowDiagnostics({
  panelElement,
  activeTabId,
  status,
  tabIdsKey,
  previousSignature
}: CardOverflowLogParams): string {
  const cards = Array.from(
    panelElement.querySelectorAll<HTMLElement>('[data-card-surface="true"]')
  );

  if (cards.length === 0) {
    logger.debug("[UI][DebugFix] Card overflow audit skipped (no card surfaces found)", {
      activeTabId,
      status,
      tabIdsKey
    });
    return `${activeTabId}|none`;
  }

  const entries: CardOverflowEntry[] = cards.map((card, index) => {
    const computed = window.getComputedStyle(card);
    return {
      index,
      id: card.id || card.getAttribute("data-card-id"),
      className: card.className ?? "",
      overflowX: computed.overflowX,
      overflowY: computed.overflowY
    };
  });

  const offenders = entries.filter(
    (entry) => entry.overflowY === "hidden" || entry.overflowY === "clip"
  );

  const signature = `${activeTabId}|${entries
    .map((entry) => `${entry.className}:${entry.overflowX}/${entry.overflowY}`)
    .join(";")}`;

  if (signature === previousSignature) {
    return signature;
  }

  if (offenders.length > 0) {
    logger.warn("[UI][DebugFix] Card surfaces blocking vertical scroll propagation", {
      activeTabId,
      status,
      tabIdsKey,
      offenderCount: offenders.length,
      offenders
    });
  } else {
    logger.debug("[UI][DebugFix] Card overflow audit passed", {
      activeTabId,
      status,
      tabIdsKey,
      cardCount: entries.length,
      snapshot: entries
    });
  }

  return signature;
}

import { logger } from "@shared/utils/logger";
import type { AnalysisStatus } from "../../../types/analysis-status";
import type { AnalysisTabDescriptor } from "../../../types/analysis-tabs";

export function auditPanelVisibility({
  panelElement,
  status,
  activeTabId,
  tabs
}: {
  panelElement: HTMLElement;
  status: AnalysisStatus;
  activeTabId: string;
  tabs: AnalysisTabDescriptor[];
}): void {
  const visibleSections = Array.from(
    panelElement.querySelectorAll<HTMLElement>(".analysis-panel-section:not([hidden])")
  );

  if (visibleSections.length !== 1) {
    logger.warn("[UI] Unexpected analysis panel visibility", {
      status,
      activeTabId,
      visiblePanels: visibleSections.map((section) => section.id),
      tabOrder: tabs.map((tab) => tab.id)
    });
  }
}

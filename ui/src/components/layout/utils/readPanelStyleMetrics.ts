import { logger } from "@shared/utils/logger";

export type PanelStyleMetrics = {
  maxHeightDeclaration: string;
  boxSizing: string;
  paddingTop: number;
  paddingBottom: number;
  paddingBlock: number;
  borderBlock: number;
  sectionPaddingBlock: number | null;
  sectionPaddingInline: number | null;
};

export function readPanelStyleMetrics(panelElement: HTMLElement): PanelStyleMetrics {
  const parseMetric = (value: string | null | undefined): number => {
    if (!value) return 0;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  let maxHeightDeclaration = "none";
  let boxSizing = "unknown";
  let paddingTop = 0;
  let paddingBottom = 0;
  let paddingBlock = 0;
  let borderBlock = 0;
  let sectionPaddingBlock: number | null = null;
  let sectionPaddingInline: number | null = null;

  try {
    const computed = window.getComputedStyle(panelElement);
    const maxHeightValue = computed.getPropertyValue("max-height").trim();
    if (maxHeightValue) {
      maxHeightDeclaration = maxHeightValue;
    }
    boxSizing = computed.getPropertyValue("box-sizing")?.trim() || computed.boxSizing || "content-box";
    paddingTop = parseMetric(computed.getPropertyValue("padding-top"));
    paddingBottom = parseMetric(computed.getPropertyValue("padding-bottom"));
    paddingBlock = paddingTop + paddingBottom;
    borderBlock =
      parseMetric(computed.getPropertyValue("border-top-width")) +
      parseMetric(computed.getPropertyValue("border-bottom-width"));

    const section =
      panelElement.querySelector<HTMLElement>(".analysis-panel-section[data-active=\"true\"]") ??
      panelElement.querySelector<HTMLElement>(".analysis-panel-section");
    if (section) {
      const sectionComputed = window.getComputedStyle(section);
      const sectionPaddingTop = parseMetric(sectionComputed.getPropertyValue("padding-top"));
      const sectionPaddingBottom = parseMetric(sectionComputed.getPropertyValue("padding-bottom"));
      const sectionPaddingLeft = parseMetric(sectionComputed.getPropertyValue("padding-left"));
      const sectionPaddingRight = parseMetric(sectionComputed.getPropertyValue("padding-right"));
      sectionPaddingBlock = sectionPaddingTop + sectionPaddingBottom;
      sectionPaddingInline = sectionPaddingLeft + sectionPaddingRight;
    }
  } catch (error) {
    logger.warn("[UI] Failed to read analysis panel style metrics", { error });
  }

  return {
    maxHeightDeclaration,
    boxSizing,
    paddingTop,
    paddingBottom,
    paddingBlock,
    borderBlock,
    sectionPaddingBlock,
    sectionPaddingInline
  };
}

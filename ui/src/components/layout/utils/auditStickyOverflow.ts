import { logger } from "@shared/utils/logger";

type OverflowAuditRef = { current: boolean };

export function auditStickyOverflow({
  navigationElement,
  overflowAuditLoggedRef
}: {
  navigationElement: HTMLElement;
  overflowAuditLoggedRef: OverflowAuditRef;
}): void {
  type OverflowSnapshot = {
    tag: string;
    className: string;
    overflowX: string;
    overflowY: string;
    position: string;
  };

  const snapshots: OverflowSnapshot[] = [];
  let current: HTMLElement | null = navigationElement;

  while (current) {
    const computed = window.getComputedStyle(current);
    snapshots.push({
      tag: current.tagName.toLowerCase(),
      className: current.className ?? "",
      overflowX: computed.overflowX,
      overflowY: computed.overflowY,
      position: computed.position
    });
    current = current.parentElement;
  }

  const blockers = snapshots
    .slice(1)
    .filter((snapshot) => snapshot.overflowY !== "visible" && snapshot.overflowY !== "clip");

  if (blockers.length > 0) {
    logger.warn("[UI] Sidebar sticky overflow blockers detected", {
      blockers,
      chain: snapshots
    });
  } else {
    logger.debug("[UI] Sidebar sticky overflow audit", { chain: snapshots });
  }

  overflowAuditLoggedRef.current = true;
}

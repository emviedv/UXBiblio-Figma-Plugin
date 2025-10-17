export type SkeletonStage = "analyzing" | "cancelling";

export function buildSkeletonMessage(
  stage: SkeletonStage,
  {
    hasNamedSelection,
    selectionLabel,
    sectionLabel
  }: { hasNamedSelection: boolean; selectionLabel: string; sectionLabel: string }
): string {
  if (stage === "analyzing") {
    const scope = hasNamedSelection ? `${selectionLabel} for ${sectionLabel}` : sectionLabel;
    return `Analyzing ${scope}… Insights will appear here once ready.`;
  }

  if (hasNamedSelection) {
    return `Canceling analysis for ${selectionLabel} (${sectionLabel})…`;
  }

  return `Canceling ${sectionLabel} analysis…`;
}

import { Accessibility, Brain, Eye, Lightbulb, ListChecks, Target, Type } from "lucide-react";
import type { StructuredAnalysis } from "../utils/analysis";
import type { AnalysisTabDescriptor } from "../types/analysis-tabs";
import { CopywritingCard } from "../components/CopywritingCard";
import { AccessibilityAccordion } from "../components/AccessibilityAccordion";
import { AccordionSection } from "../components/AccordionSection";
import { RecommendationsAccordion } from "../components/RecommendationsAccordion";
import { UxSummaryTab } from "../components/tabs/UxSummaryTab";
import { ProductPsychologyTab } from "../components/tabs/ProductPsychologyTab";

export function buildAnalysisTabs(structured: StructuredAnalysis): AnalysisTabDescriptor[] {
  const summary = structured.summary;
  const copywriting = structured.copywriting;
  const accessibilityExtras = structured.accessibilityExtras;

  const hasSummaryContent =
    typeof summary === "string" && summary.trim().length > 0
      ? true
      : structured.receipts.length > 0;

  const hasCopywritingSummary =
    typeof copywriting.summary === "string" && copywriting.summary.trim().length > 0;
  const hasCopywritingContent =
    hasCopywritingSummary || copywriting.guidance.length > 0 || copywriting.sources.length > 0;

  const hasAccessibilitySummary =
    typeof accessibilityExtras.summary === "string" && accessibilityExtras.summary.trim().length > 0;
  const hasAccessibilityContent =
    structured.accessibility.length > 0 ||
    typeof accessibilityExtras.contrastScore === "number" ||
    hasAccessibilitySummary ||
    accessibilityExtras.issues.length > 0 ||
    accessibilityExtras.recommendations.length > 0 ||
    accessibilityExtras.sources.length > 0;

  const hasHeuristicsContent = structured.heuristics.length > 0;
  const hasPsychologyContent = structured.psychology.length > 0;
  const hasImpactContent = structured.impact.length > 0;
  const hasRecommendationsContent = structured.recommendations.length > 0;

  return [
    {
      id: "ux-summary",
      label: "UX Summary",
      icon: Eye,
      hasContent: hasSummaryContent,
      emptyMessage: "No UX summary available for this selection.",
      render: () =>
        hasSummaryContent ? (
          <UxSummaryTab
            summary={structured.summary}
            receipts={structured.receipts}
            meta={{
              flows: structured.flows,
              industries: structured.industries,
              uiElements: structured.uiElements,
              psychologyTags: structured.psychologyTags,
              suggestedTitle: structured.suggestedTitle,
              suggestedTags: structured.suggestedTags,
              confidence: structured.confidence,
              obsCount: structured.obsCount
            }}
            suggestions={structured.copywriting.guidance}
          />
        ) : null
    },
    {
      id: "ux-copywriting",
      label: "UX Copy",
      icon: Type,
      hasContent: hasCopywritingContent,
      emptyMessage: "No UX copy guidance available for this selection.",
      render: () =>
        hasCopywritingContent ? (
          <CopywritingCard copywriting={structured.copywriting} tabLabel="UX Copy" />
        ) : null
    },
    {
      id: "accessibility",
      label: "Accessibility",
      icon: Accessibility,
      hasContent: hasAccessibilityContent,
      emptyMessage: "No accessibility insights surfaced for this analysis.",
      render: () =>
        hasAccessibilityContent ? (
          <AccessibilityAccordion
            items={structured.accessibility}
            extras={structured.accessibilityExtras}
            icon={Accessibility}
          />
        ) : null
    },
    {
      id: "heuristics",
      label: "Heuristics",
      icon: ListChecks,
      hasContent: hasHeuristicsContent,
      emptyMessage: "No heuristics surfaced for this analysis.",
      render: () =>
        hasHeuristicsContent ? (
          <AccordionSection title="Heuristic Insights" items={structured.heuristics} icon={ListChecks} />
        ) : null
    },
    {
      id: "psychology",
      label: "Psychology",
      icon: Brain,
      hasContent: hasPsychologyContent,
      emptyMessage: "No psychology insights captured for this analysis.",
      render: () =>
        hasPsychologyContent ? (
          <ProductPsychologyTab items={structured.psychology} />
        ) : null
    },
    {
      id: "impact",
      label: "Impact",
      icon: Target,
      hasContent: hasImpactContent,
      emptyMessage: "No impact insights captured for this analysis.",
      render: () =>
        hasImpactContent ? (
          <AccordionSection title="Impact Overview" items={structured.impact} icon={Target} />
        ) : null
    },
    {
      id: "recommendations",
      label: "Next Steps",
      icon: Lightbulb,
      hasContent: hasRecommendationsContent,
      emptyMessage: "No next steps provided for this selection.",
      render: () =>
        hasRecommendationsContent ? (
          <RecommendationsAccordion recommendations={structured.recommendations} icon={Lightbulb} />
        ) : null
    }
  ];
}

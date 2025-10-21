import type { AnalysisResultPayload } from "@shared/types/messages";
import type { StructuredAnalysis } from "../utils/analysis";
import { extractAnalysisData, normalizeAnalysis } from "../utils/analysis";

export function buildStructuredAnalysis(
  analysis: AnalysisResultPayload | null,
  fallback: StructuredAnalysis
): { structured: StructuredAnalysis; missingStructuralData: boolean } {
  if (!analysis) {
    return { structured: fallback, missingStructuralData: false };
  }

  const normalized = normalizeAnalysis(extractAnalysisData(analysis.analysis));
  const missing =
    normalized.heuristics.length === 0 &&
    normalized.accessibility.length === 0 &&
    normalized.psychology.length === 0 &&
    normalized.impact.length === 0 &&
    normalized.recommendations.length === 0;

  return { structured: normalized, missingStructuralData: missing };
}

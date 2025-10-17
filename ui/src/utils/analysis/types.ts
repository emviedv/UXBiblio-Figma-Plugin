export interface AnalysisSectionItem {
  title: string;
  description?: string;
  severity?: string;
  score?: number;
  metadata?: Record<string, string | string[]>;
}

export interface AnalysisSource {
  title: string;
  url?: string;
  domainTier?: string;
  publishedYear?: number;
  usedFor?: string;
}

export interface AccessibilityExtras {
  contrastScore?: number;
  contrastStatus?: string;
  keyRecommendation?: string;
  summary?: string;
  issues: string[];
  recommendations: string[];
  sources: AnalysisSource[];
  guardrails: string[];
}

export interface HeuristicScorecardEntry {
  name: string;
  score?: number;
  reason?: string;
}

export interface HeuristicScorecard {
  strengths: HeuristicScorecardEntry[];
  weaknesses: HeuristicScorecardEntry[];
  opportunities: HeuristicScorecardEntry[];
}

export interface CopywritingSectionBlock {
  type: "text" | "list";
  text?: string;
  items?: string[];
}

export interface CopywritingSectionEntry {
  id?: string;
  title?: string;
  blocks: CopywritingSectionBlock[];
}

export interface CopywritingContent {
  heading?: string;
  summary?: string;
  guidance: string[];
  sources: AnalysisSource[];
  sections: CopywritingSectionEntry[];
}

export interface StructuredAnalysis {
  summary?: string;
  scopeNote?: string;
  receipts: AnalysisSource[];
  copywriting: CopywritingContent;
  accessibilityExtras: AccessibilityExtras;
  heuristicScorecard: HeuristicScorecard;
  heuristics: AnalysisSectionItem[];
  accessibility: AnalysisSectionItem[];
  psychology: AnalysisSectionItem[];
  impact: AnalysisSectionItem[];
  recommendations: string[];
  contentType?: string;
  flows: string[];
  industries: string[];
  uiElements: string[];
  psychologyTags: string[];
  suggestedTitle?: string;
  suggestedTags: string[];
  suggestedCollection?: string;
  confidence?: { level?: string; rationale?: string };
  obsCount?: number;
  promptVersion?: string;
  uxSignals: string[];
}

export interface ConfidencePayload {
  level?: string;
  rationale?: string;
}

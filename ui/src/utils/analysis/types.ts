export interface AnalysisSectionItem {
  title: string;
  description?: string;
  severity?: string;
  score?: number;
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
  summary?: string;
  issues: string[];
  recommendations: string[];
  sources: AnalysisSource[];
}

export interface CopywritingContent {
  heading?: string;
  summary?: string;
  guidance: string[];
  sources: AnalysisSource[];
}

export interface StructuredAnalysis {
  summary?: string;
  scopeNote?: string;
  receipts: AnalysisSource[];
  copywriting: CopywritingContent;
  accessibilityExtras: AccessibilityExtras;
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
}

export interface ConfidencePayload {
  level?: string;
  rationale?: string;
}

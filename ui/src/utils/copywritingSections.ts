import type {
  AnalysisSectionItem,
  CopywritingSectionEntry,
  StructuredAnalysis
} from "./analysis/types";
import { splitIntoParagraphs, stripObservationTokens } from "./strings";
import { logger } from "@shared/utils/logger";

export interface CopywritingSection {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

const COPY_KEYWORD_PATTERN =
  /\b(copy|text|cta|call to action|message|messaging|tone|voice|microcopy|language|label|headline|tagline|content|writing)\b/i;
const META_PREFIX_PATTERN = /^(stage|guardrail|flow|pillar|intent|audience|meta)\s*[:\-–—]\s*/i;

export function buildCopywritingSections(analysis: StructuredAnalysis): CopywritingSection[] {
  const provided = convertProvidedSections(analysis.copywriting.sections);
  if (provided.length > 0) {
    return provided;
  }

  const sections: CopywritingSection[] = [];

  const summaryParagraphs = buildMessagingSummary(analysis);
  if (summaryParagraphs.length > 0) {
    sections.push({
      id: "messaging-summary",
      title: "Messaging Summary",
      paragraphs: summaryParagraphs
    });
  }

  const voiceTone = buildVoiceTone(analysis);
  if (voiceTone.length > 0) {
    sections.push({
      id: "voice-tone",
      title: "Voice & Tone",
      paragraphs: voiceTone
    });
  }

  const heuristicBullets = buildHeuristicObservations(analysis.heuristics);
  if (heuristicBullets.length > 0) {
    sections.push({
      id: "heuristic-observations",
      title: "Copy Observations from Heuristics",
      bullets: heuristicBullets
    });
  }

  const highImpact = buildHighImpactOpportunities(analysis);
  if (highImpact.length > 0) {
    sections.push({
      id: "high-impact",
      title: "High-Impact Copy Opportunities",
      bullets: highImpact
    });
  }

  const longTerm = buildLongTermMessagingBets(analysis.recommendations);
  if (longTerm.length > 0) {
    sections.push({
      id: "long-term",
      title: "Long-term Messaging Bets",
      bullets: longTerm
    });
  }

  const impactNotes = buildCopyRisksImpact(analysis.impact);
  if (impactNotes.length > 0) {
    sections.push({
      id: "copy-risk",
      title: "Copy Risks & Impact",
      paragraphs: impactNotes
    });
  }

  const notableCopy = buildNotableOnScreenCopy(analysis);
  if (notableCopy.length > 0) {
    sections.push({
      id: "notable-copy",
      title: "Notable On-screen Copy",
      bullets: notableCopy
    });
  }

  if (sections.length === 0 && analysis.copywriting.heading) {
    logger.debug("[CopywritingSections] No content sections generated; falling back to heading-only state", {
      heading: analysis.copywriting.heading
    });
  }

  return sections;
}

function convertProvidedSections(entries: CopywritingSectionEntry[] | undefined): CopywritingSection[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const sections: CopywritingSection[] = [];

  entries.forEach((section, index) => {
    if (!section || !Array.isArray(section.blocks) || section.blocks.length === 0) {
      return;
    }

    const id = section.id?.trim() || `section-${index + 1}`;
    const title = section.title?.trim() || `Section ${index + 1}`;
    const paragraphs: string[] = [];
    const bullets: string[] = [];

    for (const block of section.blocks) {
      if (!block) continue;
      if (block.type === "list" && Array.isArray(block.items)) {
        for (const item of block.items) {
          pushBullet(bullets, item);
        }
        continue;
      }

      if (block.type === "text" && typeof block.text === "string") {
        pushParagraph(paragraphs, block.text);
      }
    }

    const normalizedParagraphs = dedupeNormalized(paragraphs);
    const normalizedBullets = dedupeNormalized(bullets);
    if (normalizedParagraphs.length === 0 && normalizedBullets.length === 0) {
      return;
    }
    sections.push({
      id,
      title,
      paragraphs: normalizedParagraphs.length > 0 ? normalizedParagraphs : undefined,
      bullets: normalizedBullets.length > 0 ? normalizedBullets : undefined
    });
  });

  return sections;
}

function pushParagraph(collection: string[], value: string | undefined) {
  if (!value) return;
  const sanitizedBlock = stripNormalizationMeta(stripObservationTokens(value));
  const splits = splitIntoParagraphs(sanitizedBlock);
  for (const paragraph of splits) {
    const sanitized = sanitizeParagraph(paragraph);
    if (!sanitized) continue;
    collection.push(sanitized);
  }
}

function pushBullet(collection: string[], value: string | undefined) {
  if (!value) return;
  const sanitized = sanitizeParagraph(stripNormalizationMeta(stripObservationTokens(value)));
  if (!sanitized || !isMeaningfulCopyLine(sanitized)) {
    return;
  }
  collection.push(sanitized);
}

function buildMessagingSummary(analysis: StructuredAnalysis): string[] {
  const candidates: Array<string | undefined> = [
    analysis.copywriting.summary,
    analysis.scopeNote,
    analysis.copywriting.summary ? undefined : analysis.summary
  ];
  const lines = candidates
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(stripObservationTokens)
    .map(stripNormalizationMeta)
    .flatMap((value) => splitIntoParagraphs(value))
    .map((paragraph) => sanitizeParagraph(paragraph));

  return dedupeNormalized(lines);
}

function buildVoiceTone(analysis: StructuredAnalysis): string[] {
  if (!Array.isArray(analysis.psychology) || analysis.psychology.length === 0) {
    return [];
  }

  const lines: string[] = [];

  for (const item of analysis.psychology) {
    if (!item) continue;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const description = typeof item.description === "string" ? item.description.trim() : "";
    if (!title && !description) continue;

    const severity = typeof item.severity === "string" ? item.severity.trim() : "";
    const normalizedDescription = sanitizeParagraph(stripNormalizationMeta(stripObservationTokens(description)));
    if (!title && !normalizedDescription) continue;

    const labelParts = [title || "Voice cue"];
    if (severity) {
      labelParts.push(`(${capitalize(severity)})`);
    }
    const line = [labelParts.join(" "), normalizedDescription].filter(Boolean).join(" — ");
    if (line) {
      lines.push(line);
    }
  }

  return dedupeNormalized(lines).slice(0, 5);
}

function buildHeuristicObservations(items: AnalysisSectionItem[]): string[] {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const observations: string[] = [];

  for (const item of items) {
    if (!item) continue;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const description = typeof item.description === "string" ? item.description.trim() : "";
    const combined = stripNormalizationMeta(stripObservationTokens(combineTitleDescription(title, description)));
    if (!combined || !isCopyRelevant(combined)) {
      continue;
    }
    observations.push(sanitizeParagraph(combined));
  }

  return dedupeNormalized(observations).slice(0, 6);
}

function buildHighImpactOpportunities(analysis: StructuredAnalysis): string[] {
  const guidanceItems = Array.isArray(analysis.copywriting.guidance)
    ? analysis.copywriting.guidance
    : [];
  const sanitizedGuidance = guidanceItems
    .map((item) => sanitizeParagraph(stripNormalizationMeta(stripObservationTokens(item))))
    .filter(isMeaningfulCopyLine);

  if (sanitizedGuidance.length > 0) {
    return dedupeNormalized(sanitizedGuidance).slice(0, 5);
  }

  const immediate = extractRecommendationsByBucket(analysis.recommendations, "immediate");
  if (immediate.length > 0) {
    return immediate.slice(0, 5);
  }

  return [];
}

function buildLongTermMessagingBets(recommendations: string[]): string[] {
  const longTerm = extractRecommendationsByBucket(recommendations, "long-term");
  return longTerm.slice(0, 5);
}

function buildCopyRisksImpact(items: AnalysisSectionItem[]): string[] {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const notes: string[] = [];

  for (const item of items) {
    if (!item) continue;
    const description = typeof item.description === "string" ? item.description.trim() : "";
    if (!description) {
      continue;
    }
    const normalizedDescription = sanitizeParagraph(stripNormalizationMeta(stripObservationTokens(description)));
    if (!normalizedDescription) {
      continue;
    }

    const severity = typeof item.severity === "string" ? item.severity.trim() : "";
    const title = typeof item.title === "string" ? item.title.trim() : "";

    if (title || severity) {
      const label = [title, severity ? `(${capitalize(severity)} severity)` : null]
        .filter(Boolean)
        .join(" ");
      notes.push(`${label ? `${label}: ` : ""}${normalizedDescription}`.trim());
    } else {
      notes.push(normalizedDescription);
    }
  }

  return dedupeNormalized(notes).slice(0, 5);
}

function buildNotableOnScreenCopy(analysis: StructuredAnalysis): string[] {
  const snippets: string[] = [];

  const accumulateFromText = (value?: string) => {
    if (!value) return;
    const sanitized = stripNormalizationMeta(stripObservationTokens(value));
    const paragraphs = sanitized.split(/\n+/);
    for (const paragraph of paragraphs) {
      const trimmedParagraph = sanitizeParagraph(paragraph);
      if (!trimmedParagraph) continue;
      const sentences = trimmedParagraph
        .split(/(?<=[.!?])\s+/)
        .map((segment) => sanitizeParagraph(segment))
        .filter(Boolean);
      const targets = sentences.length > 0 ? sentences : [trimmedParagraph];
      for (const sentence of targets) {
        if (!sentence) continue;
        const normalized = sentence.replace(/\s{2,}/g, " ").trim();
        if (normalized.length < 12) continue;
        snippets.push(normalized);
      }
    }
  };

  accumulateFromText(analysis.copywriting.summary);
  if (analysis.copywriting.guidance.length > 0) {
    for (const line of analysis.copywriting.guidance) {
      if (!line) continue;
      const sanitized = sanitizeParagraph(stripNormalizationMeta(stripObservationTokens(line)));
      if (sanitized.length >= 10) {
        snippets.push(sanitized);
      }
    }
  }

  if (!snippets.length) {
    for (const heuristic of analysis.heuristics) {
      if (!heuristic || !heuristic.description) continue;
      const sanitized = sanitizeParagraph(stripNormalizationMeta(stripObservationTokens(heuristic.description)));
      if (sanitized.length >= 12) {
        snippets.push(sanitized);
      }
    }
  }

  return dedupeNormalized(snippets).slice(0, 5);
}

type RecommendationBucket = "immediate" | "long-term";

function extractRecommendationsByBucket(entries: string[], bucket: RecommendationBucket): string[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const normalizedBucket = bucket.toLowerCase();
  const collected: string[] = [];

  for (const entry of entries) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const { matchedBucket, text } = parseRecommendation(trimmed);
    if (!text || matchedBucket !== normalizedBucket) {
      continue;
    }

    collected.push(text);
  }

  return dedupeNormalized(collected);
}

function parseRecommendation(value: string): { matchedBucket: string | null; text: string | null } {
  let remaining = value;
  let matchedBucket: string | null = null;

  const priorityMatch = remaining.match(/^\[(immediate|immediate actions|long-term|long term|longterm)[^\]]*]/i);
  if (priorityMatch) {
    const label = priorityMatch[1].toLowerCase();
    matchedBucket = label.startsWith("immediate") ? "immediate" : "long-term";
    remaining = remaining.slice(priorityMatch[0].length).trim();
  }

  remaining = remaining.replace(/\[(impact|effort|refs)\s*:[^\]]*]/gi, "").trim();
  remaining = stripNormalizationMeta(stripObservationTokens(remaining));
  const sanitized = sanitizeParagraph(remaining);

  return { matchedBucket, text: sanitized || null };
}

function sanitizeParagraph(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s+([.,!?;:])/g, "$1").trim();
}

function stripNormalizationMeta(value: string): string {
  if (!value) {
    return "";
  }

  const sanitizedLines = value
    .split(/\n+/)
    .map((line) => {
      let normalized = line.trim();
      while (META_PREFIX_PATTERN.test(normalized)) {
        normalized = normalized.replace(META_PREFIX_PATTERN, "").trim();
      }
      return normalized;
    })
    .filter((line) => line.length > 0);

  return sanitizedLines.join("\n");
}

function combineTitleDescription(title: string, description: string): string {
  if (title && description) {
    return `${title}: ${description}`;
  }

  return title || description;
}

function dedupeNormalized(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function isCopyRelevant(text: string): boolean {
  if (!text) return false;
  return COPY_KEYWORD_PATTERN.test(text);
}

function isMeaningfulCopyLine(text: string): boolean {
  const trimmed = sanitizeParagraph(text);
  if (!trimmed) return false;
  if (trimmed.length < 12) return false;
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount < 2) return false;
  const alphaRatio = (trimmed.match(/[A-Za-z]/g) ?? []).length / trimmed.length;
  return alphaRatio >= 0.6;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

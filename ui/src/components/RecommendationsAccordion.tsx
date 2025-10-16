import { useMemo } from "react";
import { CardSection } from "./CardSection";
import { SeverityBadge } from "./SeverityBadge";
import { sanitizeRecommendationText } from "../utils/analysis/recommendations";
import { Badge } from "./primitives/Badge";
import { logger } from "@shared/utils/logger";

export function RecommendationsAccordion({
  recommendations
}: {
  recommendations: string[];
}): JSX.Element | null {
  const partitioned = useMemo(() => partitionRecommendationEntries(recommendations), [
    recommendations
  ]);

  if (!recommendations.length) {
    return null;
  }

  return (
    <section
      className="card accordion accordion-open"
      data-card-surface="true"
      aria-label="Recommendations"
    >
      <ul className="card-body">
        {partitioned.priority && (
          <li className="card-item">
            <CardSection
              title="Overall Priority"
              actions={<SeverityBadge severity={partitioned.priority} />}
            >
              <></>
            </CardSection>
          </li>
        )}

        {partitioned.immediate.length > 0 && (
          <li className="card-item">
            <CardSection title="Immediate Actions">
              {partitioned.immediate.map((item, index) => (
                <div key={`immediate-${index}`} className="card-item-recommendation">
                  <div className="recommendation-meta" aria-label="Recommendation metadata">
                    {item.meta.impact ? (
                      <Badge tone="impact" aria-label={`Impact ${item.meta.impact}`}>
                        {`Impact ${capitalize(item.meta.impact)}`}
                      </Badge>
                    ) : null}
                    {item.meta.effort ? (
                      <Badge tone="effort" aria-label={`Effort ${item.meta.effort}`}>
                        {`Effort ${capitalize(item.meta.effort)}`}
                      </Badge>
                    ) : null}
                    {item.meta.refs ? (
                      <Badge tone="refs" aria-label="References">
                        {formatRefsForDisplay(item.meta.refs)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="card-item-description">{item.text}</p>
                </div>
              ))}
            </CardSection>
          </li>
        )}

        {partitioned.longTerm.length > 0 && (
          <li className="card-item">
            <CardSection title="Long-term Next Steps">
              {partitioned.longTerm.map((item, index) => (
                <div key={`longterm-${index}`} className="card-item-recommendation">
                  <div className="recommendation-meta" aria-label="Recommendation metadata">
                    {item.meta.impact ? (
                      <Badge tone="impact" aria-label={`Impact ${item.meta.impact}`}>
                        {`Impact ${capitalize(item.meta.impact)}`}
                      </Badge>
                    ) : null}
                    {item.meta.effort ? (
                      <Badge tone="effort" aria-label={`Effort ${item.meta.effort}`}>
                        {`Effort ${capitalize(item.meta.effort)}`}
                      </Badge>
                    ) : null}
                    {item.meta.refs ? (
                      <Badge tone="refs" aria-label="References">
                        {formatRefsForDisplay(item.meta.refs)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="card-item-description">{item.text}</p>
                </div>
              ))}
            </CardSection>
          </li>
        )}

        {partitioned.general.map((item, index) => (
          <li key={`general-${index}`} className="card-item">
            <CardSection>
              <div className="card-item-recommendation">
                <div className="recommendation-meta" aria-label="Recommendation metadata">
                  {item.meta.impact ? (
                    <Badge tone="impact" aria-label={`Impact ${item.meta.impact}`}>
                      {`Impact ${capitalize(item.meta.impact)}`}
                    </Badge>
                  ) : null}
                  {item.meta.effort ? (
                    <Badge tone="effort" aria-label={`Effort ${item.meta.effort}`}>
                      {`Effort ${capitalize(item.meta.effort)}`}
                    </Badge>
                  ) : null}
                  {item.meta.refs ? (
                    <Badge tone="refs" aria-label="References">
                      {formatRefsForDisplay(item.meta.refs)}
                    </Badge>
                  ) : null}
                </div>
                <p className="card-item-description">{item.text}</p>
              </div>
            </CardSection>
          </li>
        ))}
      </ul>
    </section>
  );
}

type ParsedRec = { text: string; meta: { impact?: string; effort?: string; refs?: string } };

function partitionRecommendationEntries(entries: string[]): {
  priority: string | null;
  immediate: ParsedRec[];
  longTerm: ParsedRec[];
  general: ParsedRec[];
} {
  const immediate: ParsedRec[] = [];
  const longTerm: ParsedRec[] = [];
  const general: ParsedRec[] = [];
  let priority: string | null = null;

  for (const entry of entries) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;

    if (/^overall priority:/i.test(trimmed)) {
      const priorityValue = sanitizeRecommendationText(trimmed.replace(/^overall priority:\s*/i, "").trim());
      if (priorityValue) priority = priorityValue;
      continue;
    }

    const parsed = parseRecommendationWithMeta(trimmed);

    if (/^\[immediate(?:[^\]]*)?]/i.test(trimmed)) {
      immediate.push(parsed);
      continue;
    }

    if (/^\[long-term(?:[^\]]*)?]/i.test(trimmed)) {
      longTerm.push(parsed);
      continue;
    }

    general.push(parsed);
  }

  return { priority, immediate, longTerm, general };
}

function parseRecommendationWithMeta(raw: string): ParsedRec {
  // Robustly parse bracketed blocks with nesting; capture meta anywhere in the string.
  const meta: { impact?: string; effort?: string; refs?: string } = {};
  const ALLOW_META = new Set(["impact", "effort", "refs"]);
  const PRIORITY_LABELS: Record<string, string> = {
    immediate: "[Immediate]",
    "immediate actions": "[Immediate]",
    "long-term": "[Long-term]",
    "long term": "[Long-term]",
    longterm: "[Long-term]"
  };

  type Block = { start: number; end: number; inside: string };

  const blocks: Block[] = [];
  const value = raw;
  // Depth-aware scan
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] !== "[") continue;
    let depth = 0;
    let j = i;
    let found = -1;
    let nestedSeen = false;
    for (; j < value.length; j += 1) {
      const ch = value[j];
      if (ch === "[") {
        depth += 1;
        if (depth > 1) nestedSeen = true;
      } else if (ch === "]") {
        depth -= 1;
        if (depth === 0) {
          found = j;
          break;
        }
      }
    }
    if (found === -1) {
      break; // unmatched, stop; sanitizer will warn elsewhere
    }
    const inside = value.slice(i + 1, found);
    blocks.push({ start: i, end: found, inside });
    // Best-effort note on nested content to aid debugging
    if (nestedSeen) {
      logger.debug("[Recommendations][meta] Nested bracket detected inside block", {
        preview: inside.slice(0, 60)
      });
    }
    i = found; // continue after this block
  }

  // Decide which blocks to drop (allowlisted meta) and capture their values
  const dropRanges: Array<{ start: number; end: number }> = [];
  let keptPriorityBlocks = 0;
  let removedMetaBlocks = 0;

  for (const b of blocks) {
    const rawInside = b.inside.trim();
    const hasColon = rawInside.includes(":");
    if (hasColon) {
      const [rawLabel, ...rest] = rawInside.split(":");
      const label = rawLabel.trim().toLowerCase();
      const remainder = rest.join(":").trim();
      // Priority: keep in text; sanitizer will canonicalize later
      if (label in PRIORITY_LABELS) {
        keptPriorityBlocks += 1;
        continue; // keep
      }
      // Allowlisted meta: capture and drop from text
      if (ALLOW_META.has(label)) {
        if (label === "impact" && !meta.impact) meta.impact = remainder;
        else if (label === "effort" && !meta.effort) meta.effort = remainder;
        else if (label === "refs" && !meta.refs) meta.refs = remainder;
        dropRanges.push({ start: b.start, end: b.end });
        removedMetaBlocks += 1;
        continue;
      }
      // Unknown labeled block: keep for now (may be handled by sanitizer)
      continue;
    }
    // Unlabeled block (e.g., [Immediate]): keep
  }

  // Rebuild string without dropped meta blocks
  let remaining = "";
  let cursor = 0;
  for (const r of dropRanges.sort((a, b) => a.start - b.start)) {
    // text up to the '['
    if (cursor < r.start) remaining += value.slice(cursor, r.start);
    // skip the block itself (from '[' to ']')
    cursor = r.end + 1;
  }
  if (cursor < value.length) remaining += value.slice(cursor);
  remaining = remaining.trim();

  // Debug-only: summary of extraction
  logger.debug("[Recommendations][meta] Extracted meta from recommendation", {
    hasImpact: Boolean(meta.impact),
    hasEffort: Boolean(meta.effort),
    hasRefs: Boolean(meta.refs),
    totalBlocks: blocks.length,
    removedMetaBlocks,
    keptPriorityBlocks,
    preview: value.slice(0, 160)
  });

  // If any meta missing, keep existing missing-meta log (do not insert visually)
  if (!meta.impact || !meta.effort || !meta.refs) {
    logger.debug("[Recommendations][meta] Missing required meta blocks", {
      hasImpact: Boolean(meta.impact),
      hasEffort: Boolean(meta.effort),
      hasRefs: Boolean(meta.refs),
      preview: raw.slice(0, 140)
    });
  }

  const text = sanitizeRecommendationText(remaining);
  return { text, meta };
}

function capitalize(value?: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatRefsForDisplay(refs: string): string {
  // Remove colon in nested tokens to avoid exposing normalization syntax in UI text
  return (
    "Refs " +
    refs
      .replace(/\bimpact:\s*/gi, "impact·")
      .replace(/\bheuristics:\s*/gi, "heuristics·")
      .trim()
  );
}

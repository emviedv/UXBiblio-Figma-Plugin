const OBS_TOKEN_PATTERN = /\bOBS-\d+\b/i;

export function stripObservationTokens(text: string): string {
  if (!OBS_TOKEN_PATTERN.test(text)) {
    return text;
  }

  const sanitizedLines = text
    .split("\n")
    .map((line) => sanitizeObservationLine(line))
    .filter((line) => line.length > 0);

  return sanitizedLines.join("\n").trim();
}

export function sanitizeObservationLine(line: string): string {
  if (!line) {
    return "";
  }

  let output = line.replace(/\(\s*OBS-\d+\s*\)/gi, "");
  output = output.replace(/\bOBS-\d+\b/gi, "");
  output = output.replace(/,\s*,/g, ", ");
  output = output.replace(/,\s*(?=[\])])/g, "");
  output = output.replace(/[ \t]{2,}/g, " ");
  output = output.replace(/\s+([,.;:])/g, "$1");
  output = output.replace(/^[,;:\s-]+/, "");
  output = output.replace(/[,;:\s-]+$/, "");
  output = normalizeObservationParentheses(output);
  output = output.replace(/\s*\|\s*/g, " | ");
  output = output.replace(/\s{2,}/g, " ").trim();
  output = output.replace(/^\|\s*/, "").replace(/\s*\|$/, "");
  return output.trim();
}

function normalizeObservationParentheses(value: string): string {
  return value.replace(/\(([^)]*)\)/g, (match, inner) => {
    const trimmed = inner.trim();
    if (!trimmed) {
      return "";
    }

    if (!/[|,]/.test(trimmed)) {
      return `(${trimmed})`;
    }

    const tokens = trimmed
      .split(/[,|]/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    if (tokens.length === 0) {
      return "";
    }

    return `(${tokens.join(", ")})`;
  });
}

/**
 * Split a block of analysis text into visually readable paragraphs.
 *
 * Rules:
 * - Prefer author-provided line breaks (one or more newlines).
 * - If none are present, split on sentence boundaries and
 *   start a new paragraph when the sentence looks like a recommendation
 *   (e.g., begins with "To ", "Consider ", "We recommend", "Ensure ").
 * - Fallback: if the text is long with multiple sentences, split after the
 *   first sentence to improve readability while keeping semantics intact.
 */
export function splitIntoParagraphs(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.includes("\n")) {
    return trimmed
      .split(/\n+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  const sentences = trimmed.split(/(?<=[.!?])\s+(?=[A-Z"“(])/g).map((s) => s.trim());
  if (sentences.length <= 1) return [trimmed];

  const maxSentencesPerParagraph = 2;
  const maxCharsPerParagraph = 260;

  const paragraphs: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  for (const sentence of sentences) {
    const nextLen = (currentLen ? currentLen + 1 : 0) + sentence.length;
    if (
      current.length >= maxSentencesPerParagraph ||
      (current.length > 0 && nextLen > maxCharsPerParagraph)
    ) {
      paragraphs.push(current.join(" "));
      current = [sentence];
      currentLen = sentence.length;
    } else {
      current.push(sentence);
      currentLen = nextLen;
    }
  }

  if (current.length) {
    paragraphs.push(current.join(" "));
  }

  return paragraphs;
}

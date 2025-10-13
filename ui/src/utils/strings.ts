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
  return output.trim();
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

  // Honor explicit line breaks first.
  if (trimmed.includes("\n")) {
    return trimmed
      .split(/\n+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  // Sentence-based chunking. We avoid keyword-specific rules; instead,
  // group sentences into small paragraphs for readability.
  const sentences = trimmed.split(/(?<=[.!?])\s+(?=[A-Z"“\(])/g).map((s) => s.trim());
  if (sentences.length <= 1) return [trimmed];

  const maxSentencesPerParagraph = 2; // general readability target
  const maxCharsPerParagraph = 260; // soft cap; start new paragraph if exceeded

  const paragraphs: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  for (const s of sentences) {
    const nextLen = (currentLen ? currentLen + 1 : 0) + s.length; // +1 for a space when joining
    if (
      current.length >= maxSentencesPerParagraph ||
      (current.length > 0 && nextLen > maxCharsPerParagraph)
    ) {
      paragraphs.push(current.join(" "));
      current = [s];
      currentLen = s.length;
    } else {
      current.push(s);
      currentLen = nextLen;
    }
  }
  if (current.length) paragraphs.push(current.join(" "));

  return paragraphs;
}

import { stripObservationTokens } from "../strings";

export function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const sanitized = stripObservationTokens(trimmed);
  return sanitized.length ? sanitized : undefined;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const results: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;

    const sanitized = stripObservationTokens(trimmed);
    if (sanitized) results.push(sanitized);
  }
  return results;
}

export function mergeDescription(
  base: string | undefined,
  addition: string | undefined
): string | undefined {
  if (!addition) return base;
  if (!base) return addition;
  return `${base}\n${addition}`;
}

export function mergeUniqueStrings(groups: string[][]): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item)) continue;
      seen.add(item);
      results.push(item);
    }
  }

  return results;
}

export function mergeParts(parts: string[]): string | undefined {
  const text = parts.join("\n").trim();
  return text.length ? text : undefined;
}

export function pushIf(parts: string[], value: string | undefined): void {
  if (value) parts.push(value);
}

export function pushList(
  parts: string[],
  label: string,
  values: string[],
  joiner: string
): void {
  if (!values.length) return;
  parts.push(`${label}: ${values.join(joiner)}`);
}

type MetadataAccumulator = Record<string, string | string[]>;

export type MetadataConfigEntry = {
  key?: string;
  multi?: boolean;
  parser?: (value: string) => string | string[] | undefined;
  transform?: (value: string) => string;
};

const METADATA_LINE_PATTERN = /^([A-Za-z][A-Za-z\s]+?)\s*[:\-–—]\s*(.+)$/;

export function stripLabeledMetadata(
  value: string | undefined,
  config: Record<string, MetadataConfigEntry>,
  accumulator: MetadataAccumulator
): string | undefined {
  if (!value) {
    return value;
  }

  const normalizedConfig = new Map<string, MetadataConfigEntry>();
  for (const [label, entry] of Object.entries(config)) {
    normalizedConfig.set(normalizeMetadataLabel(label), entry);
  }

  const lines = value.split(/\r?\n+/);
  const retained: string[] = [];

  for (const originalLine of lines) {
    const line = originalLine.trim();
    if (!line) {
      continue;
    }

    const normalizedLine = line.replace(/^[-•\u2022]\s*/, "");
    const match = METADATA_LINE_PATTERN.exec(normalizedLine);
    if (!match) {
      retained.push(line);
      continue;
    }

    const labelKey = normalizeMetadataLabel(match[1]);
    const configEntry = normalizedConfig.get(labelKey);
    if (!configEntry) {
      retained.push(line);
      continue;
    }

    const rawValue = (match[2] || "").trim();
    if (!rawValue) {
      continue;
    }

    if (!configEntry.key) {
      // Drop recognized metadata without persisting it.
      continue;
    }

    const parsed = configEntry.parser ? configEntry.parser(rawValue) : rawValue;
    if (parsed == null || (typeof parsed === "string" && !parsed.trim())) {
      continue;
    }

    applyMetadataValue(accumulator, configEntry.key, parsed, configEntry);
  }

  const sanitized = retained.map((line) => line.trim()).filter(Boolean).join("\n");
  return sanitized.length ? sanitized : undefined;
}

function normalizeMetadataLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

function applyMetadataValue(
  accumulator: MetadataAccumulator,
  key: string,
  parsed: string | string[],
  entry: MetadataConfigEntry
): void {
  const shouldUseArray = entry.multi ?? Array.isArray(parsed);
  const normalizedValues = (Array.isArray(parsed) ? parsed : [parsed])
    .map((value) => (entry.transform ? entry.transform(value) : value))
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (!normalizedValues.length) {
    return;
  }

  if (!shouldUseArray && normalizedValues.length === 1) {
    accumulator[key] = normalizedValues[0];
    return;
  }

  const existing = accumulator[key];
  const baseline = Array.isArray(existing)
    ? existing
    : existing != null
    ? [String(existing)]
    : [];
  const merged = mergeUniqueStrings([baseline, normalizedValues]);
  accumulator[key] = merged;
}

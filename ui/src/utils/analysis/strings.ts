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

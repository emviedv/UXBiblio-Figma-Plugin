import { asString } from "./strings";
import { normalizePublishedYear } from "./numbers";
import type { AnalysisSource } from "./types";

const ARTICLE_HOSTS = new Set([
  "www.nngroup.com",
  "nngroup.com",
  "www.baymard.com",
  "baymard.com",
  "www.interaction-design.org",
  "interaction-design.org"
]);

export function normalizeReceipts(value: unknown): AnalysisSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const entry = item as Record<string, unknown>;
      const rawTitle = asString(entry["title"]);
      const url = canonicalizeSourceUrl(asString(entry["url"]));
      const domainTier = asString(entry["domainTier"]);
      const usedFor = asString(entry["usedFor"]);
      const publishedYear = normalizePublishedYear(entry["publishedYear"]);

      if (!rawTitle && !url) {
        return null;
      }

      return {
        title: rawTitle ?? url ?? "Source",
        url,
        domainTier,
        usedFor,
        publishedYear
      };
    })
    .filter(Boolean) as AnalysisSource[];
}

export function gatherSectionSources(record: Record<string, unknown>): AnalysisSource[] {
  const results: AnalysisSource[] = [];

  const heuristicsRaw = Array.isArray(record["heuristics"]) ? record["heuristics"] : [];
  for (const h of heuristicsRaw) {
    if (!h || typeof h !== "object") continue;
    const entry = h as Record<string, unknown>;
    const sources = normalizeReceipts(entry["sources"]);
    if (sources.length) results.push(...sources);
  }

  const impactObj = record["impact"];
  if (impactObj && typeof impactObj === "object") {
    const impactRecord = impactObj as Record<string, unknown>;
    const areasValue = impactRecord["areas"];
    const areas = Array.isArray(areasValue) ? areasValue : [];
    for (const area of areas) {
      if (!isUnknownRecord(area)) continue;
      const sources = normalizeReceipts(area["sources"]);
      if (sources.length) results.push(...sources);
    }
  }

  const psychologyObj = record["psychology"];
  if (psychologyObj && typeof psychologyObj === "object") {
    const psychologyRecord = psychologyObj as Record<string, unknown>;
    const persuasionValue = psychologyRecord["persuasionTechniques"];
    const pers = Array.isArray(persuasionValue) ? persuasionValue : [];
    for (const p of pers) {
      if (!isUnknownRecord(p)) continue;
      const sources = normalizeReceipts(p["sources"]);
      if (sources.length) results.push(...sources);
    }
    const triggersValue = psychologyRecord["behavioralTriggers"];
    const triggers = Array.isArray(triggersValue) ? triggersValue : [];
    for (const t of triggers) {
      if (!isUnknownRecord(t)) continue;
      const sources = normalizeReceipts(t["sources"]);
      if (sources.length) results.push(...sources);
    }
  }

  return results;
}

export function dedupeSources(sources: AnalysisSource[]): AnalysisSource[] {
  const seen = new Set<string>();
  const out: AnalysisSource[] = [];
  for (const s of sources) {
    const key = `${(s.title || "").toLowerCase()}|${(s.url || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}

function canonicalizeSourceUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const withScheme = /^(https?:)?\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;

  try {
    const url = new URL(withScheme);

    url.protocol = "https:";
    url.username = "";
    url.password = "";

    if (url.hostname === "nngroup.com") {
      url.hostname = "www.nngroup.com";
    }

    if (ARTICLE_HOSTS.has(url.hostname) && shouldAppendSlash(url.pathname)) {
      url.pathname = `${url.pathname}/`;
    }

    return url.toString();
  } catch {
    return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  }
}

function shouldAppendSlash(pathname: string): boolean {
  if (!pathname || pathname === "/") {
    return false;
  }

  if (pathname.endsWith("/")) {
    return false;
  }

  const lastSegment = pathname.split("/").pop() ?? "";
  if (!lastSegment) {
    return false;
  }

  if (/\.[a-z0-9]+$/i.test(lastSegment)) {
    return false;
  }

  return true;
}

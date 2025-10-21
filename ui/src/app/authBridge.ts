import { logger } from "@shared/utils/logger";
import type { CreditsSummary } from "@shared/types/messages";

export type AccountStatus = CreditsSummary["accountStatus"];

export type CreditsState = CreditsSummary;

const AUTH_STATUS_TYPE_TOKENS = [
  "uxbiblio:auth-status",
  "uxb-auth-status",
  "uxb_auth_status",
  "uxbiblio_auth_status",
  "uxbiblio-auth-status"
] as const;

/**
 * Known bridge channel identifiers emitted by the runtime for auth updates.
 */
export const AUTH_STATUS_TYPE_MATCHERS = new Set<string>(AUTH_STATUS_TYPE_TOKENS);

/**
 * Runtime namespaces that flag messages containing auth state.
 */
export const AUTH_STATUS_SOURCE_PREFIXES = ["uxbiblio:auth", "uxb-auth", "uxb_auth", "uxbiblio_auth"] as const;

export const AUTH_STATUS_KEYS = [
  "status",
  "accountStatus",
  "plan",
  "planSlug",
  "plan_slug",
  "planType",
  "plan_type",
  "tier",
  "tierSlug",
  "tier_slug",
  "subscription",
  "subscriptionPlan",
  "subscription_plan",
  "membership",
  "membershipLevel",
  "uxbAccountStatus",
  "accountType",
  "account_type"
] as const;

/**
 * Normalizes credit counts from the bridge while preserving the fallback object when unchanged.
 */
export function normalizeCreditsPayload(
  raw: CreditsSummary | undefined,
  fallback: CreditsState
): CreditsState {
  if (!raw) {
    return fallback;
  }

  const total = Number.isFinite(raw.totalFreeCredits)
    ? Math.max(0, Math.floor(raw.totalFreeCredits))
    : fallback.totalFreeCredits;
  const remainingCandidate = Number.isFinite(raw.remainingFreeCredits)
    ? Math.floor(raw.remainingFreeCredits)
    : fallback.remainingFreeCredits;
  const remaining = Math.max(0, Math.min(total, remainingCandidate));
  const accountStatus = normalizeAccountStatusFromPayload(raw.accountStatus, fallback.accountStatus);

  if (
    total === fallback.totalFreeCredits &&
    remaining === fallback.remainingFreeCredits &&
    accountStatus === fallback.accountStatus
  ) {
    return fallback;
  }

  return {
    totalFreeCredits: total,
    remainingFreeCredits: remaining,
    accountStatus
  };
}

/**
 * Harmonises various runtime account status tokens into the UI-friendly enum.
 */
export function normalizeAccountStatusFromPayload(
  candidate: unknown,
  fallback: AccountStatus
): AccountStatus {
  if (typeof candidate !== "string") {
    return fallback;
  }

  const normalized = candidate.trim().toLowerCase();
  if (
    normalized === "pro" ||
    normalized === "professional" ||
    normalized === "paid" ||
    normalized === "premium" ||
    normalized === "plus" ||
    normalized === "team" ||
    normalized === "business" ||
    normalized === "enterprise" ||
    normalized === "scale" ||
    normalized === "growth" ||
    normalized === "ultimate" ||
    normalized === "agency" ||
    normalized === "agency_plus" ||
    normalized === "agency-plus" ||
    normalized.includes("professional") ||
    normalized.startsWith("pro-") ||
    normalized.startsWith("pro_") ||
    normalized.endsWith("-pro") ||
    normalized.endsWith("_pro")
  ) {
    return "pro";
  }

  if (
    normalized === "trial" ||
    normalized === "trialing" ||
    normalized === "trialling" ||
    normalized === "free_trial" ||
    normalized === "free-trial" ||
    normalized === "free_trialing" ||
    normalized === "preview" ||
    normalized === "beta" ||
    normalized.includes("trial")
  ) {
    return "trial";
  }

  if (
    normalized === "anonymous" ||
    normalized === "anon" ||
    normalized === "free" ||
    normalized === "guest" ||
    normalized === "logged_out" ||
    normalized === "logged-out" ||
    normalized === "loggedout" ||
    normalized === "unauthenticated" ||
    normalized === "public"
  ) {
    return "anonymous";
  }

  if (normalized.length > 0) {
    logger.debug("[AuthBridge] Unrecognized account status token", {
      candidate,
      normalized,
      fallback
    });
  }

  return fallback;
}

/**
 * Walks through nested bridge payloads to recover the first known auth status string.
 */
export function extractAuthStatusFromMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  if ("pluginMessage" in record) {
    return null;
  }

  const candidateRecords: Array<Record<string, unknown>> = [];
  const visited = new Set<unknown>();
  const queue: Array<Record<string, unknown>> = [record];
  const maxCandidates = 16;

  while (queue.length > 0 && candidateRecords.length < maxCandidates) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);
    candidateRecords.push(current);

    for (const value of Object.values(current)) {
      if (!value || typeof value !== "object") {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (
            item &&
            typeof item === "object" &&
            !visited.has(item) &&
            candidateRecords.length + queue.length < maxCandidates * 2
          ) {
            queue.push(item as Record<string, unknown>);
          }
        }
        continue;
      }

      if (!visited.has(value) && candidateRecords.length + queue.length < maxCandidates * 2) {
        queue.push(value as Record<string, unknown>);
      }
    }
  }

  const typeValue = typeof record.type === "string" ? record.type.toLowerCase() : "";
  const sourceValue = typeof record.source === "string" ? record.source.toLowerCase() : "";
  const namespaceValue = typeof record.namespace === "string" ? record.namespace.toLowerCase() : "";

  const isAuthTyped =
    AUTH_STATUS_TYPE_MATCHERS.has(typeValue) || AUTH_STATUS_TYPE_MATCHERS.has(namespaceValue);
  const hasAuthSource =
    AUTH_STATUS_SOURCE_PREFIXES.some((prefix) => sourceValue.startsWith(prefix)) ||
    AUTH_STATUS_SOURCE_PREFIXES.some((prefix) => namespaceValue.startsWith(prefix));
  const hasExplicitFlag =
    record.uxbAuth === true ||
    record.__uxbAuth === true ||
    record.__UXB_AUTH__ === true ||
    record.channel === "uxbiblio:auth";

  if (!isAuthTyped && !hasAuthSource && !hasExplicitFlag) {
    const hasKnownKey = candidateRecords.some((candidateRecord) =>
      AUTH_STATUS_KEYS.some((key) => typeof candidateRecord[key] === "string")
    );
    if (!hasKnownKey) {
      return null;
    }
  }

  for (const candidateRecord of candidateRecords) {
    for (const key of AUTH_STATUS_KEYS) {
      const value = candidateRecord[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }
  }

  return null;
}

/**
 * Reads the DEBUG_FIX flag exposed via the Figma dev console to toggle verbose logging.
 */
export function isDebugFixActive(): boolean {
  if (typeof globalThis === "undefined") {
    return false;
  }

  const scope = globalThis as Record<string, unknown>;
  const raw = scope.DEBUG_FIX ?? scope.__DEBUG_FIX__;

  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "enabled";
  }

  return Boolean(raw);
}

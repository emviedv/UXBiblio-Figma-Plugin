let cachedDebugFix: boolean | null = null;

function readEnvFlag(value: unknown): boolean | null {
  if (value == null) return null;
  if (value === true) return true;
  if (value === false) return false;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return null;
}

export function isDebugFixEnabled(): boolean {
  if (cachedDebugFix != null) {
    return cachedDebugFix;
  }

  let flag: boolean | null = null;

  if (typeof globalThis !== "undefined") {
    flag =
      readEnvFlag((globalThis as Record<string, unknown>).DEBUG_FIX) ??
      readEnvFlag((globalThis as Record<string, unknown>).__DEBUG_FIX__);
  }

  if (flag == null && typeof process !== "undefined") {
    flag =
      readEnvFlag((process as unknown as Record<string, unknown>).env?.DEBUG_FIX) ??
      readEnvFlag((process as unknown as Record<string, unknown>).env?.VITE_DEBUG_FIX);
  }

  if (flag == null && typeof import.meta !== "undefined" && "env" in import.meta) {
    const metaEnv = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
    flag = readEnvFlag(metaEnv.DEBUG_FIX) ?? readEnvFlag(metaEnv.VITE_DEBUG_FIX);
  }

  cachedDebugFix = flag ?? false;
  return cachedDebugFix;
}

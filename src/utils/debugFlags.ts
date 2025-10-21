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
    const scope = globalThis as Record<string, unknown>;
    flag = readEnvFlag(scope["DEBUG_FIX"]) ?? readEnvFlag(scope["__DEBUG_FIX__"]);
  }

  if (flag == null && typeof process !== "undefined") {
    const envRecord = (process as unknown as { env?: Record<string, unknown> }).env;
    flag = readEnvFlag(envRecord?.["DEBUG_FIX"]) ?? readEnvFlag(envRecord?.["VITE_DEBUG_FIX"]);
  }

  cachedDebugFix = flag ?? false;
  return cachedDebugFix;
}

export function enableDebugFixForSession(): void {
  cachedDebugFix = true;

  if (typeof globalThis === "object" && globalThis !== null) {
    const scope = globalThis as Record<string, unknown>;
    scope["DEBUG_FIX"] = true;
    scope["__DEBUG_FIX__"] = true;
  }

  if (typeof process === "object" && process !== null) {
    const envRecord = (process as unknown as { env?: Record<string, string | undefined> }).env;
    if (envRecord) {
      envRecord["DEBUG_FIX"] = "1";
      envRecord["VITE_DEBUG_FIX"] = "1";
    }
  }
}

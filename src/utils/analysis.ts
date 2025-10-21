import { debugService } from "../services/debug-service";

const DEFAULT_TIMEOUT_MS = 20_000;
const networkLog = debugService.forContext("Network");

interface FlowFramePayload {
  frameId: string;
  frameName: string;
  index: number;
  image: string;
  metadata?: unknown;
}

interface AnalysisPayload {
  selectionName: string;
  frames: FlowFramePayload[];
  metadata?: unknown;
}

interface RequestOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const TIMEOUT_ERROR_MESSAGE = "Analysis took too long. Try again or simplify your selection.";

function resolveFetchImplementation(customImpl?: typeof fetch): typeof fetch | undefined {
  if (customImpl) {
    return customImpl;
  }

  if (typeof fetch === "function") {
    return fetch;
  }

  if (typeof globalThis !== "undefined") {
    const maybeFetch = (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch;
    if (typeof maybeFetch === "function") {
      return maybeFetch;
    }
  }

  if (typeof self !== "undefined") {
    const maybeFetch = (self as typeof self & { fetch?: typeof fetch }).fetch;
    if (typeof maybeFetch === "function") {
      return maybeFetch;
    }
  }

  if (typeof window !== "undefined") {
    const maybeFetch = (window as typeof window & { fetch?: typeof fetch }).fetch;
    if (typeof maybeFetch === "function") {
      return maybeFetch;
    }
  }

  return undefined;
}

export async function sendAnalysisRequest(
  endpoint: string,
  payload: AnalysisPayload,
  options: RequestOptions = {}
): Promise<unknown> {
  const fetchImpl = resolveFetchImplementation(options.fetchImpl);

  if (!fetchImpl) {
    throw new Error("Fetch implementation not available in this environment.");
  }

  const AbortCtor = getAbortController();
  const controller = AbortCtor ? new AbortCtor() : undefined;
  const externalSignal = options.signal;
  let removeExternalAbort: (() => void) | undefined;
  let timedOut = false;

  if (controller && externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      const onExternalAbort = () => controller.abort();
      externalSignal.addEventListener("abort", onExternalAbort);
      removeExternalAbort = () =>
        externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }

  const timeout = setTimeout(() => {
    if (controller && !controller.signal.aborted) {
      timedOut = true;
      controller.abort();
    }
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const cleanup = () => {
    clearTimeout(timeout);
    removeExternalAbort?.();
  };

  try {
    if (!Array.isArray(payload.frames) || payload.frames.length === 0) {
      throw new Error("At least one frame must be provided for analysis.");
    }

    const requestInit: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, source: "figma-plugin" })
    };

    if (controller?.signal) {
      // Assign lazily so environments without AbortController ignore unsupported keys.
      (requestInit as RequestInit & { signal: AbortSignal }).signal = controller.signal;
    }

    const response = await fetchImpl(endpoint, requestInit);

    cleanup();

    if (!response.ok) {
      const errorText = await safelyReadText(response);
      throw new Error(
        `Analysis request failed (${response.status}): ${errorText || "Unknown error"}`
      );
    }

    return response.json();
  } catch (error) {
    cleanup();

    if (isAbortError(error)) {
      networkLog.warn("Analysis request aborted", {
        endpoint,
        timedOut,
        reason: error instanceof Error ? error.message : String(error)
      });
      throw new Error(TIMEOUT_ERROR_MESSAGE);
    }

    const normalized = normalizeFetchError(error, endpoint);

    networkLog.error("Analysis request failed before response", {
      endpoint,
      cause: error instanceof Error ? error.message : String(error),
      normalizedMessage: normalized.message
    });

    throw normalized;
  }
}

function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === "AbortError";
}

function getAbortController():
  | (new () => {
      signal: AbortSignal;
      abort: () => void;
    })
  | undefined {
  if (typeof AbortController === "function") {
    return AbortController;
  }

  return undefined;
}

async function safelyReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function normalizeFetchError(error: unknown, endpoint: string): Error {
  if (error instanceof Error) {
    const message = (error.message ?? "").toLowerCase();
    const isNetworkFailure =
      error.name === "TypeError" &&
      (message.includes("failed to fetch") || message.includes("network request failed"));

    if (isNetworkFailure) {
      return new Error(
        `Unable to reach the analysis service at ${endpoint}. ` +
          "Confirm UXBIBLIO_ANALYSIS_URL and network connectivity, then rebuild the plugin."
      );
    }

    return error;
  }

  return new Error(String(error));
}

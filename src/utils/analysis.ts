import { debugService } from "../services/debug-service";

const DEFAULT_TIMEOUT_MS = 20_000;
const networkLog = debugService.forContext("Network");

interface AnalysisPayload {
  image: string;
  selectionName: string;
  metadata?: unknown;
  palette?: { hex: string; name?: string }[];
}

interface RequestOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const TIMEOUT_ERROR_MESSAGE = "Analysis took too long. Try again or simplify your selection.";

export async function sendAnalysisRequest(
  endpoint: string,
  payload: AnalysisPayload,
  options: RequestOptions = {}
): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

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

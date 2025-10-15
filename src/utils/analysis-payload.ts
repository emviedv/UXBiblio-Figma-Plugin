import promptVersionMeta from "../config/prompt-version.json";
import { debugService } from "../services/debug-service";
import type { DebugChannel } from "../services/debug-service";

export interface PrepareAnalysisContext {
  selectionName: string;
  exportedAt: string;
}

interface ProxyResponseShape {
  analysis?: unknown;
  metadata?: unknown;
  selectionName?: string;
}

export function prepareAnalysisPayload(
  proxyResponse: unknown,
  context: PrepareAnalysisContext
): {
  selectionName: string;
  analysis: unknown;
  metadata?: unknown;
  exportedAt: string;
} {
  const payloadLog = debugService.forContext("Analysis Payload");
  const promptVersion = promptVersionMeta.version ?? "0.0.0";

  if (!isRecord(proxyResponse)) {
    payloadLog.debug("Proxy response not an object; forwarding raw analysis", {
      selectionName: context.selectionName,
      responseType: typeof proxyResponse
    });
    return {
      ...context,
      analysis: proxyResponse,
      metadata: undefined
    };
  }

  const proxyShape = proxyResponse as ProxyResponseShape;
  const nestedAnalysis = proxyShape.analysis;

  if (nestedAnalysis && typeof nestedAnalysis === "object") {
    const hasPromptVersion = hasPromptVersionField(nestedAnalysis);
    payloadLog.debug("Flattened proxy analysis payload", {
      selectionName: context.selectionName,
      heuristicsCount: countItems(nestedAnalysis, "heuristics"),
      accessibilityKeys: summarizeKeys(nestedAnalysis, "accessibility"),
      impactKeys: summarizeKeys(nestedAnalysis, "impact"),
      recommendationsKeys: summarizeKeys(nestedAnalysis, "recommendations"),
      promptVersion,
      promptVersionEmbedded: hasPromptVersion
    });
    return {
      ...context,
      analysis: attachPromptVersion(nestedAnalysis, promptVersion, payloadLog, context.selectionName),
      metadata: proxyShape.metadata
    };
  }

  payloadLog.debug("Proxy response missing nested analysis; forwarding as-is", {
    selectionName: context.selectionName,
    heuristicsCount: countItems(proxyResponse, "heuristics")
  });
  return {
    ...context,
    analysis: attachPromptVersion(proxyResponse, promptVersion, payloadLog, context.selectionName),
    metadata: proxyShape.metadata
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function countItems(value: unknown, key: string): number | null {
  if (!isRecord(value)) {
    return null;
  }

  const candidate = value[key];
  if (Array.isArray(candidate)) {
    return candidate.length;
  }

  if (candidate && typeof candidate === "object") {
    return Object.keys(candidate as Record<string, unknown>).length;
  }

  return null;
}

function summarizeKeys(value: unknown, key: string): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const candidate = value[key];
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const keys = Object.keys(candidate as Record<string, unknown>);
  return keys.length ? keys.slice(0, 5).join(",") : "object-empty";
}

function hasPromptVersionField(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(value, "promptVersion");
}

function attachPromptVersion(
  analysis: unknown,
  promptVersion: string,
  logger: DebugChannel,
  selectionName: string
): unknown {
  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
    return analysis;
  }

  if (Object.prototype.hasOwnProperty.call(analysis, "promptVersion")) {
    return analysis;
  }

  logger.debug("Injecting prompt version into analysis payload", {
    selectionName,
    promptVersion
  });

  return { ...(analysis as Record<string, unknown>), promptVersion };
}

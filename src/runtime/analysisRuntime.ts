import { exportSelectionToBase64 } from "../utils/export";
import { sendAnalysisRequest } from "../utils/analysis";
import { prepareAnalysisPayload } from "../utils/analysis-payload";
import { isDebugFixEnabled } from "../utils/debugFlags";
import type {
  AccountStatus,
  CreditsSummary,
  FlowSelectionSummary,
  PluginToUiMessage
} from "../types/messages";
import { debugService, type DebugChannel } from "../services/debug-service";

export interface AnalysisRuntimeChannels {
  analysis: DebugChannel;
  selection: DebugChannel;
  network: DebugChannel;
}

export interface AnalysisRuntimeOptions {
  analysisEndpoint: string;
  promptVersion: string;
  notifyUI: (message: PluginToUiMessage) => void;
  channels: AnalysisRuntimeChannels;
}

type ExportableNode = SceneNode & { exportAsync(settings?: ExportSettings): Promise<Uint8Array> };

interface ActiveAnalysis {
  flowKey: string;
  selectionName: string;
  frameCount: number;
  frameIds: string[];
  controller?: AbortController;
  cancelled: boolean;
  notified: boolean;
}

interface CachedAnalysis {
  flowKey: string;
  frameCount: number;
  promptVersion: string;
  analysis?: unknown;
  metadata?: unknown;
  exportedAt?: string;
}

interface CachedImage {
  version: number;
  image: string;
}

interface FlowFrameInfo {
  node: ExportableNode;
  id: string;
  name: string;
  version: number;
  index: number;
}

interface FlowFramePayload {
  frameId: string;
  frameName: string;
  index: number;
  image: string;
  metadata: Record<string, unknown>;
}

const NO_SELECTION_ERROR = "Please select a Frame or Group before analyzing.";
const CREDITS_EXHAUSTED_ERROR =
  "No credits remaining. Sign in or upgrade to continue analyzing with UXBiblio.";
const FREE_CREDIT_LIMIT = 0;
const CREDIT_STORAGE_KEY = "uxbiblio.freeCredits";
const MAX_FLOW_FRAMES = 5;

interface CreditsState extends CreditsSummary {}

interface StoredCreditsSnapshot {
  remaining?: unknown;
  total?: unknown;
  accountStatus?: unknown;
}

const DEFAULT_CREDITS_STATE: CreditsState = {
  totalFreeCredits: FREE_CREDIT_LIMIT,
  remainingFreeCredits: FREE_CREDIT_LIMIT,
  accountStatus: "anonymous"
};

function isPaidStatus(status: AccountStatus): boolean {
  return status === "trial" || status === "pro";
}

function deriveCreditsForStatus(status: AccountStatus): { totalFreeCredits: number; remainingFreeCredits: number } {
  if (isPaidStatus(status)) {
    // Paid plans bypass credit gating entirely; counters remain zeroed for UI consistency.
    return {
      totalFreeCredits: FREE_CREDIT_LIMIT,
      remainingFreeCredits: FREE_CREDIT_LIMIT
    };
  }

  return {
    totalFreeCredits: 0,
    remainingFreeCredits: 0
  };
}

export function createAnalysisRuntime({
  analysisEndpoint,
  promptVersion,
  notifyUI,
  channels
}: AnalysisRuntimeOptions) {
  let activeAnalysis: ActiveAnalysis | null = null;
  const analysisCache = new Map<string, CachedAnalysis>();
  const imageCache = new Map<string, CachedImage>();
  const creditsLog = debugService.forContext("Credits");
  let creditsState: CreditsState = { ...DEFAULT_CREDITS_STATE };
  let creditsLoadPromise: Promise<void> | null = null;
  const debugFixEnabled = isDebugFixEnabled();

  /** Returns the current credit summary shared with the UI layer. */
  function getCreditsPayload(): CreditsSummary {
    return { ...creditsState };
  }

  /** Indicates whether the current account has paid or trial access. */
  function hasPaidAccess(): boolean {
    return isPaidStatus(creditsState.accountStatus);
  }

  /** Determines if free credits have been depleted for anonymous usage. */
  function isCreditBlocked(_requiredCredits: number): boolean {
    if (hasPaidAccess()) {
      return false;
    }

    return true;
  }

  async function ensureCreditsLoaded(): Promise<void> {
    if (creditsLoadPromise) {
      await creditsLoadPromise;
      return;
    }

    const storage = figma.clientStorage;
    if (!storage?.getAsync) {
      creditsLog.debug("Figma clientStorage unavailable; using default credit state");
      return;
    }

    creditsLoadPromise = (async () => {
      try {
        const stored = await storage.getAsync(CREDIT_STORAGE_KEY);
        const parsed = parseStoredCredits(stored);
        if (parsed) {
          creditsState = parsed;
          creditsLog.debug("Loaded credits from storage", {
            remaining: creditsState.remainingFreeCredits,
            total: creditsState.totalFreeCredits,
            accountStatus: creditsState.accountStatus
          });
        } else if (stored != null) {
          creditsLog.warn("Stored credits malformed; resetting to defaults", {
            storedShape: typeof stored
          });
          await storage.setAsync(CREDIT_STORAGE_KEY, serializeCredits(creditsState));
        }
      } catch (error) {
        creditsLog.warn("Failed to load credits from storage", {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })();

    try {
      await creditsLoadPromise;
    } finally {
      creditsLoadPromise = null;
      syncSelectionStatus();
    }
  }

  function parseStoredCredits(raw: unknown): CreditsState | null {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const snapshot = raw as StoredCreditsSnapshot;
    if (typeof snapshot.remaining !== "number") {
      return null;
    }

    const accountStatus = normalizeAccountStatus(snapshot.accountStatus) ?? "anonymous";
    const baseline = deriveCreditsForStatus(accountStatus);

    return {
      totalFreeCredits: baseline.totalFreeCredits,
      remainingFreeCredits: baseline.remainingFreeCredits,
      accountStatus
    };
  }

  function serializeCredits(state: CreditsState): StoredCreditsSnapshot {
    return {
      remaining: state.remainingFreeCredits,
      total: state.totalFreeCredits,
      accountStatus: state.accountStatus
    };
  }

  function normalizeAccountStatus(candidate: unknown): AccountStatus | null {
    if (typeof candidate !== "string") {
      return null;
    }

    const normalized = candidate.trim().toLowerCase();
    if (normalized === "pro" || normalized === "professional") {
      return "pro";
    }
    if (normalized === "trial" || normalized === "free_trial" || normalized === "free-trial") {
      return "trial";
    }
    if (normalized === "anonymous" || normalized === "free") {
      return "anonymous";
    }

    return null;
  }

  /** Persists the in-memory credit state to clientStorage when available. */
  async function persistCreditsSnapshot(): Promise<void> {
    const storage = figma.clientStorage;
    if (!storage?.setAsync) {
      creditsLog.debug("clientStorage unavailable; skipping credit persistence");
      return;
    }

    try {
      await storage.setAsync(CREDIT_STORAGE_KEY, serializeCredits(creditsState));
    } catch (error) {
      creditsLog.warn("Failed to persist credits snapshot", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /** Decrements free credits (one per analyzed frame) when the account is anonymous. */
  async function consumeFreeCreditsIfEligible(frameCount: number): Promise<boolean> {
    if (hasPaidAccess()) {
      return false;
    }

    const normalizedCount = Math.max(0, Math.min(frameCount, MAX_FLOW_FRAMES));
    if (normalizedCount === 0) {
      return false;
    }

    if (creditsState.remainingFreeCredits <= 0) {
      return false;
    }

    const decremented = Math.min(normalizedCount, creditsState.remainingFreeCredits);
    if (decremented === 0) {
      return false;
    }

    creditsState = {
      ...creditsState,
      remainingFreeCredits: Math.max(0, creditsState.remainingFreeCredits - decremented)
    };

    creditsLog.info("Consumed free credits", {
      consumed: decremented,
      remaining: creditsState.remainingFreeCredits,
      total: creditsState.totalFreeCredits
    });

    await persistCreditsSnapshot();
    return true;
  }

  /** Updates account status heuristics when metadata surfaces plan information. */
  async function applyAccountStatusFromMetadata(metadata: unknown): Promise<boolean> {
    const nextStatus = deriveAccountStatus(metadata);
    if (!nextStatus || creditsState.accountStatus === nextStatus) {
      if (!nextStatus && metadata != null) {
        creditsLog.debug("Metadata missing account status; retaining previous credits state", {
          currentStatus: creditsState.accountStatus,
          metadataKeys: typeof metadata === "object" ? Object.keys(metadata as Record<string, unknown>) : null
        });
      }
      return false;
    }

    return updateAccountStatus(nextStatus, "metadata");
  }

  /** Extracts an account status marker from metadata payloads. */
  function deriveAccountStatus(metadata: unknown): AccountStatus | null {
    if (!metadata || typeof metadata !== "object") {
      return null;
    }

    const record = metadata as Record<string, unknown>;
    const direct = normalizeAccountStatus(record.accountStatus);
    if (direct) {
      return direct;
    }

    const account = record.account;
    if (account && typeof account === "object") {
      const accountRecord = account as Record<string, unknown>;
      const status =
        normalizeAccountStatus(accountRecord.status) ??
        normalizeAccountStatus(accountRecord.plan) ??
        normalizeAccountStatus(accountRecord.tier) ??
        normalizeAccountStatus(accountRecord.type);
      if (status) {
        return status;
      }
    }

    return null;
  }

  async function updateAccountStatus(
    nextStatus: AccountStatus,
    source: "metadata" | "auth"
  ): Promise<boolean> {
    if (creditsState.accountStatus === nextStatus) {
      creditsLog.debug("Account status unchanged", {
        source,
        status: nextStatus
      });
      return false;
    }

    const previousStatus = creditsState.accountStatus;
    const snapshot = deriveCreditsForStatus(nextStatus);

    creditsState = {
      ...creditsState,
      accountStatus: nextStatus,
      totalFreeCredits: snapshot.totalFreeCredits,
      remainingFreeCredits: snapshot.remainingFreeCredits
    };

    creditsLog.info("Account status updated", {
      source,
      previous: previousStatus,
      next: nextStatus
    });

    await persistCreditsSnapshot();
    return true;
  }

  async function syncAccountStatusFromAuth(nextStatus: AccountStatus): Promise<boolean> {
    const updated = await updateAccountStatus(nextStatus, "auth");
    if (updated) {
      syncSelectionStatus();
    }
    return updated;
  }

  function syncSelectionStatus(): void {
    const selection = figma.currentPage.selection;
    const totalSelected = selection.length;
    const flowFrames = buildFlowFrames(selection);
    const frameCount = flowFrames.length;
    const nonExportableCount = Math.max(0, totalSelected - frameCount);
    const limitExceeded = frameCount > MAX_FLOW_FRAMES;
    const trimmedFrames = flowFrames.slice(0, MAX_FLOW_FRAMES);
    const requiredCredits = trimmedFrames.length;
    const creditsInsufficient =
      requiredCredits > 0 && isCreditBlocked(requiredCredits) && !hasPaidAccess();
    const selectionName =
      trimmedFrames.length > 0
        ? composeSelectionName(trimmedFrames)
        : totalSelected > 0 && selection[0]?.name
          ? selection[0].name
          : undefined;

    const warnings: string[] = [];
    if (nonExportableCount > 0) {
      warnings.push("Some selected layers cannot be analyzed. Choose frames or groups.");
    }
    if (limitExceeded) {
      warnings.push(`Select up to ${MAX_FLOW_FRAMES} frames for flow analysis.`);
    }
    if (creditsInsufficient) {
      warnings.push("No credits remaining. Sign in to continue analyzing.");
    }

    const flowSummary: FlowSelectionSummary | undefined =
      trimmedFrames.length > 0
        ? createFlowSelectionSummary({
            frames: trimmedFrames,
            totalSelected,
            nonExportableCount,
            limitExceeded,
            requiredCredits
          })
        : undefined;

    const hasAnalyzableSelection = Boolean(flowSummary) && !limitExceeded;

    channels.selection.debug("Sync selection status", {
      analyzable: hasAnalyzableSelection,
      totalSelected,
      frameCount,
      nonExportableCount,
      limitExceeded,
      requiredCredits,
      selectionName,
      selectionIds: selection.map((node) => node.id),
      warnings,
      freeCreditsRemaining: creditsState.remainingFreeCredits,
      accountStatus: creditsState.accountStatus
    });

    if (debugFixEnabled && flowSummary) {
      channels.selection.debug("[DEBUG_FIX] Flow selection summary", flowSummary);
    }

    notifyUI({
      type: "SELECTION_STATUS",
      payload: {
        hasSelection: hasAnalyzableSelection,
        selectionName,
        warnings: warnings.length ? warnings : undefined,
        analysisEndpoint,
        credits: getCreditsPayload(),
        flow: flowSummary
      }
    });
  }

  async function handleAnalyzeSelection(): Promise<void> {
    await ensureCreditsLoaded();

    const selection = figma.currentPage.selection;
    const flowFrames = buildFlowFrames(selection);

    if (!flowFrames.length) {
      notifyUI({ type: "ANALYSIS_ERROR", error: NO_SELECTION_ERROR });
      return;
    }

    if (flowFrames.length > MAX_FLOW_FRAMES) {
      const message = `Select up to ${MAX_FLOW_FRAMES} frames for flow analysis.`;
      notifyUI({ type: "ANALYSIS_ERROR", error: message });
      figma.notify?.(message);
      return;
    }

    const selectionName = composeSelectionName(flowFrames);
    const flowKey = computeFlowKey(flowFrames);
    const frameIds = flowFrames.map((frame) => frame.id);
    const frameCount = flowFrames.length;
    const requiredCredits = frameCount;

    const cachedAnalysis = getCachedAnalysis(flowKey);
    if (cachedAnalysis?.analysis && !isStructurallyEmptyAnalysis(cachedAnalysis.analysis)) {
      const summary = summarizeAnalysisContent(cachedAnalysis.analysis);
      channels.analysis.info("Serving cached flow analysis", {
        flowKey,
        frameCount,
        ...summary
      });
      const exportedAt = cachedAnalysis.exportedAt ?? new Date().toISOString();
      notifyUI({
        type: "ANALYSIS_RESULT",
        payload: {
          selectionName,
          analysis: cachedAnalysis.analysis,
          metadata: cachedAnalysis.metadata,
          exportedAt,
          frameCount
        }
      });
      return;
    }

    if (!hasPaidAccess() && isCreditBlocked(requiredCredits)) {
      const message = CREDITS_EXHAUSTED_ERROR;

      creditsLog.warn("Blocking analysis; account lacks paid access", {
        flowKey,
        selectionName,
        requiredCredits,
        accountStatus: creditsState.accountStatus
      });
      channels.analysis.warn("Analysis blocked due to insufficient credits", {
        flowKey,
        selectionName,
        accountStatus: creditsState.accountStatus
      });
      notifyUI({ type: "ANALYSIS_ERROR", error: message });
      figma.notify?.(message);
      return;
    }

    const controller = createAbortController();
    const analysisRun: ActiveAnalysis = {
      flowKey,
      selectionName,
      frameCount,
      frameIds,
      controller,
      cancelled: false,
      notified: false
    };

    activeAnalysis = analysisRun;

    notifyUI({
      type: "ANALYSIS_IN_PROGRESS",
      payload: { selectionName, frameCount }
    });
    channels.analysis.debug("Dispatched ANALYSIS_IN_PROGRESS", {
      flowKey,
      selectionName,
      frameCount
    });

    channels.analysis.info("Starting flow analysis", {
      flowKey,
      selectionName,
      frameCount
    });

    try {
      const framePayloads: FlowFramePayload[] = [];
      const frameDiagnostics: Array<{ frameId: string; frameName: string; version: number }> = [];

      for (const frame of flowFrames) {
        const base64Image = await getOrExportBase64Image(frame, selectionName);

        if (analysisRun.cancelled) {
          channels.analysis.debug("Analysis cancelled after export", { selectionName, flowKey });
          notifyAnalysisCancelled(analysisRun);
          return;
        }

        const frameMetadata = buildFrameMetadata(frame, selectionName, frameCount);
        framePayloads.push({
          frameId: frame.id,
          frameName: frame.name,
          index: frame.index,
          image: base64Image,
          metadata: frameMetadata
        });
        frameDiagnostics.push({
          frameId: frame.id,
          frameName: frame.name,
          version: frame.version
        });
      }

      if (debugFixEnabled) {
        channels.analysis.debug("[DEBUG_FIX] Prepared flow frames", {
          flowKey,
          frameDiagnostics
        });
      }

      const flowMetadata = buildFlowRunMetadata(flowFrames, selectionName, flowKey);

      const requestStart = Date.now();
      channels.analysis.info("Sending analysis request", {
        endpoint: analysisEndpoint,
        selectionName,
        flowKey,
        frameCount
      });

      const response = await sendAnalysisRequest(
        analysisEndpoint,
        {
          selectionName,
          frames: framePayloads,
          metadata: flowMetadata
        },
        { signal: controller?.signal }
      );

      channels.analysis.info("Analysis response received", {
        selectionName,
        flowKey,
        durationMs: Date.now() - requestStart
      });

      const exportedAt = new Date().toISOString();
      const preparedPayload = prepareAnalysisPayload(response, {
        selectionName,
        exportedAt
      });

      const isEmptyAnalysis = isStructurallyEmptyAnalysis(preparedPayload.analysis);
      const analysisSummary = summarizeAnalysisContent(preparedPayload.analysis);

      if (isEmptyAnalysis) {
        channels.analysis.warn("Analysis response contained no actionable insights", {
          flowKey,
          selectionName,
          endpoint: analysisEndpoint,
          ...analysisSummary
        });
      } else {
        channels.analysis.debug("Caching analysis result", {
          flowKey,
          selectionName,
          ...analysisSummary
        });
      }

      cacheAnalysisResult(flowKey, {
        flowKey,
        frameCount,
        promptVersion,
        analysis: isEmptyAnalysis ? undefined : preparedPayload.analysis,
        metadata: isEmptyAnalysis ? undefined : preparedPayload.metadata,
        exportedAt
      });

      if (analysisRun.cancelled) {
        channels.analysis.debug("Analysis cancelled after response received", {
          selectionName,
          flowKey
        });
        notifyAnalysisCancelled(analysisRun);
        return;
      }

      notifyUI({
        type: "ANALYSIS_RESULT",
        payload: { ...preparedPayload, frameCount }
      });

      const statusChanged = await applyAccountStatusFromMetadata(preparedPayload.metadata);
      const consumedCredit = await consumeFreeCreditsIfEligible(frameCount);
      if (statusChanged || consumedCredit) {
        syncSelectionStatus();
      }

      channels.analysis.debug("Dispatched ANALYSIS_RESULT", {
        flowKey,
        selectionName,
        frameCount
      });
    } catch (error) {
      if (analysisRun.cancelled) {
        channels.analysis.debug("Analysis cancelled during pipeline", {
          selectionName,
          flowKey,
          error: error instanceof Error ? error.message : String(error)
        });
        notifyAnalysisCancelled(analysisRun);
        return;
      }

      const message = error instanceof Error ? error.message : "The analysis could not be completed.";
      notifyUI({ type: "ANALYSIS_ERROR", error: message });
      channels.analysis.error("Analysis pipeline failed", error);
    } finally {
      if (activeAnalysis === analysisRun) {
        activeAnalysis = null;
      }
    }
  }

  function cancelActiveAnalysis(): void {
    if (!activeAnalysis) {
      channels.analysis.debug("Cancel requested but no active analysis is running");
      notifyUI({
        type: "ANALYSIS_CANCELLED",
        payload: { selectionName: "", frameCount: 0 }
      });
      return;
    }

    if (activeAnalysis.cancelled) {
      channels.analysis.debug("Cancel requested but analysis already marked for cancellation", {
        selectionName: activeAnalysis.selectionName
      });
      return;
    }

    activeAnalysis.cancelled = true;
    channels.analysis.info("Cancelling active analysis", {
      selectionName: activeAnalysis.selectionName,
      flowKey: activeAnalysis.flowKey,
      frameCount: activeAnalysis.frameCount
    });

    if (activeAnalysis.controller) {
      activeAnalysis.controller.abort();
    }
  }

  function notifyAnalysisCancelled(run: ActiveAnalysis): void {
    if (run.notified) {
      return;
    }

    run.notified = true;
    channels.analysis.info("Analysis cancelled", {
      selectionName: run.selectionName,
      flowKey: run.flowKey,
      frameCount: run.frameCount
    });

    notifyUI({
      type: "ANALYSIS_CANCELLED",
      payload: { selectionName: run.selectionName, frameCount: run.frameCount }
    });
  }

  async function pingConnection(): Promise<void> {
    const url = new URL(analysisEndpoint);
    const healthUrl = `${url.origin}/health`;

    try {
      channels.network.debug("Pinging analysis health endpoint", { healthUrl });
      const res = await fetch(healthUrl, { method: "GET" });
      const ok = res.ok;
      notifyUI({ type: "PING_RESULT", payload: { ok, endpoint: healthUrl } });
      channels.network.debug("Ping result", { ok, status: res.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notifyUI({ type: "PING_RESULT", payload: { ok: false, endpoint: healthUrl, message } });
      channels.network.error("Ping request errored", error);
    }
  }

  function getCachedAnalysis(flowKey: string): CachedAnalysis | undefined {
    const cached = analysisCache.get(flowKey);
    if (!cached) {
      return undefined;
    }

    if (cached.promptVersion !== promptVersion) {
      channels.analysis.debug("Evicting cached analysis due to prompt version change", {
        flowKey,
        previousPromptVersion: cached.promptVersion,
        nextPromptVersion: promptVersion
      });
      analysisCache.delete(flowKey);
      return undefined;
    }

    return cached;
  }

  function cacheAnalysisResult(flowKey: string, payload: CachedAnalysis): void {
    analysisCache.set(flowKey, payload);
  }

  async function getOrExportBase64Image(frame: FlowFrameInfo, selectionName: string): Promise<string> {
    const cachedImageEntry = imageCache.get(frame.id);
    if (cachedImageEntry && cachedImageEntry.version === frame.version) {
      channels.analysis.debug("Reusing cached export", {
        selectionName,
        frameId: frame.id,
        frameName: frame.name,
        frameIndex: frame.index
      });
      return cachedImageEntry.image;
    }

    imageCache.delete(frame.id);

    channels.analysis.debug("Exporting frame to base64", {
      selectionName,
      frameId: frame.id,
      frameName: frame.name,
      frameIndex: frame.index
    });
    const exportStart = Date.now();
    const base64Image = await exportSelectionToBase64(frame.node);
    const exportDuration = Date.now() - exportStart;
    imageCache.set(frame.id, {
      version: frame.version,
      image: base64Image
    });
    channels.analysis.debug("Export complete", {
      selectionName,
      frameId: frame.id,
      frameName: frame.name,
      exportDurationMs: exportDuration,
      imageSizeKb: Math.round(base64Image.length / 1024)
    });
    return base64Image;
  }

  void ensureCreditsLoaded();

  return {
    syncSelectionStatus,
    handleAnalyzeSelection,
    cancelActiveAnalysis,
    pingConnection,
    syncAccountStatus: syncAccountStatusFromAuth
  };
}

function isExportableNode(node: SceneNode): node is ExportableNode {
  return typeof (node as ExportableNode).exportAsync === "function";
}

function hasDimensions(node: SceneNode): node is SceneNode & { width: number; height: number } {
  return (
    "width" in node &&
    "height" in node &&
    typeof (node as { width?: number }).width === "number" &&
    typeof (node as { height?: number }).height === "number"
  );
}

function getNodeVersion(node: SceneNode): number {
  if ("version" in node && typeof (node as { version: number }).version === "number") {
    return (node as { version: number }).version;
  }

  return 0;
}

function createAbortController(): AbortController | undefined {
  if (typeof AbortController === "function") {
    return new AbortController();
  }

  return undefined;
}

function buildFlowFrames(selection: readonly SceneNode[]): FlowFrameInfo[] {
  const frames: FlowFrameInfo[] = [];

  for (const node of selection) {
    if (!isExportableNode(node)) {
      continue;
    }

    const index = frames.length;
    frames.push({
      node,
      id: node.id,
      name: resolveNodeName(node, index),
      version: getNodeVersion(node),
      index
    });
  }

  return frames;
}

function composeSelectionName(frames: FlowFrameInfo[]): string {
  if (!frames.length) {
    return "Unnamed Selection";
  }

  const first = frames[0];
  if (frames.length === 1) {
    return first.name;
  }

  const remaining = frames.length - 1;
  const plural = remaining === 1 ? "frame" : "frames";
  return `${first.name} (+${remaining} ${plural})`;
}

function createFlowSelectionSummary({
  frames,
  totalSelected,
  nonExportableCount,
  limitExceeded,
  requiredCredits
}: {
  frames: FlowFrameInfo[];
  totalSelected: number;
  nonExportableCount: number;
  limitExceeded: boolean;
  requiredCredits: number;
}): FlowSelectionSummary {
  return {
    frameCount: frames.length,
    frameIds: frames.map((frame) => frame.id),
    frameNames: frames.map((frame) => frame.name),
    totalSelected,
    nonExportableCount,
    limitExceeded,
    requiredCredits
  };
}

function computeFlowKey(frames: FlowFrameInfo[]): string {
  return frames.map((frame) => `${frame.id}:${frame.version}`).join("|");
}

function buildFrameMetadata(
  frame: FlowFrameInfo,
  selectionName: string,
  flowSize: number
): Record<string, unknown> {
  return buildMetadata(frame.node, frame.name, {
    flowSelectionName: selectionName,
    flowIndex: frame.index,
    flowSize
  });
}

function buildFlowRunMetadata(
  frames: FlowFrameInfo[],
  selectionName: string,
  flowKey: string
): Record<string, unknown> {
  return {
    flowKey,
    selectionName,
    frameCount: frames.length,
    frames: frames.map((frame) => ({
      frameId: frame.id,
      frameName: frame.name,
      index: frame.index,
      nodeType: frame.node.type,
      dimensions: resolveFrameDimensions(frame.node)
    }))
  };
}

function buildMetadata(
  node: SceneNode,
  selectionName: string,
  options?: { flowSelectionName?: string; flowIndex?: number; flowSize?: number }
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    nodeType: node.type,
    name: selectionName
  };

  if (hasDimensions(node)) {
    metadata.frame = {
      width: node.width,
      height: node.height
    };
  }

  if (options) {
    const { flowSelectionName, flowIndex, flowSize } = options;
    metadata.flow = {
      selectionName: flowSelectionName ?? selectionName,
      index: flowIndex ?? 0,
      size: flowSize ?? 1
    };
  }

  return metadata;
}

function isStructurallyEmptyAnalysis(analysis: unknown): boolean {
  if (!analysis || typeof analysis !== "object") {
    return true;
  }

  const record = analysis as Record<string, unknown>;

  if (hasMeaningfulText(record["summary"]) || hasMeaningfulText(record["scopeNote"])) {
    return false;
  }

  if (
    hasMeaningfulCollection(record["heuristics"]) ||
    hasMeaningfulCollection(record["psychology"]) ||
    hasMeaningfulCollection(record["impact"]) ||
    hasMeaningfulCollection(record["recommendations"]) ||
    hasMeaningfulCollection(record["flows"]) ||
    hasMeaningfulCollection(record["industries"]) ||
    hasMeaningfulCollection(record["uiElements"])
  ) {
    return false;
  }

  const copywriting = record["uxCopywriting"] ?? record["copywriting"];
  if (isCopywritingMeaningful(copywriting)) {
    return false;
  }

  if (hasAccessibilityContent(record["accessibility"])) {
    return false;
  }

  const confidence = record["confidence"];
  if (confidence && typeof confidence === "object") {
    const confidenceRecord = confidence as Record<string, unknown>;
    if (
      hasMeaningfulText(confidenceRecord["level"]) ||
      hasMeaningfulText(confidenceRecord["rationale"])
    ) {
      return false;
    }
  }

  return true;
}

function summarizeAnalysisContent(analysis: unknown): {
  heuristicsCount: number;
  accessibilityCount: number;
  psychologyCount: number;
  impactCount: number;
  recommendationsCount: number;
} {
  if (!analysis || typeof analysis !== "object") {
    return {
      heuristicsCount: 0,
      accessibilityCount: 0,
      psychologyCount: 0,
      impactCount: 0,
      recommendationsCount: 0
    };
  }

  const record = analysis as Record<string, unknown>;
  return {
    heuristicsCount: getArrayLength(record["heuristics"]),
    accessibilityCount: getArrayLength(record["accessibility"]),
    psychologyCount: getArrayLength(record["psychology"]),
    impactCount: getArrayLength(record["impact"]),
    recommendationsCount: getArrayLength(record["recommendations"])
  };
}

function getArrayLength(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length;
  }
  return 0;
}

function hasMeaningfulText(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (value && typeof value === "object" && "summary" in (value as Record<string, unknown>)) {
    return hasMeaningfulText((value as Record<string, unknown>)["summary"]);
  }
  return false;
}

function hasNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function hasMeaningfulPrimitive(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "boolean") {
    return true;
  }
  return false;
}

function hasMeaningfulCollection(value: unknown, visited = new Set<unknown>()): boolean {
  if (hasNonEmptyArray(value)) {
    return true;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  if (visited.has(value)) {
    return false;
  }

  visited.add(value);

  const entries = Object.values(value as Record<string, unknown>);
  for (const entry of entries) {
    if (hasMeaningfulPrimitive(entry) || hasMeaningfulText(entry)) {
      return true;
    }
    if (hasNonEmptyArray(entry)) {
      return true;
    }
    if (entry && typeof entry === "object") {
      if (hasMeaningfulCollection(entry, visited)) {
        return true;
      }
    }
  }

  return false;
}

function isCopywritingMeaningful(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (hasMeaningfulText(record["heading"]) || hasMeaningfulText(record["summary"])) {
    return true;
  }
  return (
    hasNonEmptyArray(record["guidance"]) ||
    hasNonEmptyArray(record["sources"])
  );
}

function hasAccessibilityContent(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record["contrastScore"] === "number" ||
    hasMeaningfulText(record["summary"]) ||
    hasNonEmptyArray(record["issues"]) ||
    hasNonEmptyArray(record["recommendations"]) ||
    hasNonEmptyArray(record["sources"]) ||
    hasNonEmptyArray(record["categories"])
  );
}

function resolveNodeName(node: SceneNode, index: number): string {
  const candidate = "name" in node ? String((node as { name?: string }).name ?? "") : "";
  const trimmed = candidate.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }
  return `Frame ${index + 1}`;
}

function resolveFrameDimensions(
  node: SceneNode
): { width: number; height: number } | undefined {
  if (hasDimensions(node)) {
    return {
      width: node.width,
      height: node.height
    };
  }
  return undefined;
}

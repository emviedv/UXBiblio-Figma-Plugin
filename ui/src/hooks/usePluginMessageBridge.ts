import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { AnalysisResultPayload, PluginToUiMessage } from "@shared/types/messages";
import { logger } from "@shared/utils/logger";
import {
  AUTH_STATUS_TYPE_MATCHERS,
  extractAuthStatusFromMessage,
  normalizeAccountStatusFromPayload,
  normalizeCreditsPayload,
  type AccountStatus,
  type CreditsState
} from "../app/authBridge";
import type { BannerState, SelectionState } from "../app/appState";
import type { AnalysisStatus } from "../types/analysis-status";
import { formatEndpoint } from "../utils/url";

interface AnalysisLifecycleBridge {
  status: AnalysisStatus;
  setIdle: () => void;
  setReady: () => void;
  beginAnalysis: () => void;
  completeAnalysis: (payload: AnalysisResultPayload) => void;
  failAnalysis: (options?: { recordThresholdMs?: number }) => void;
  cancelAnalysis: (hasSelection: boolean) => void;
}

interface PluginMessageBridgeConfig {
  defaultCreditsState: CreditsState;
  timeoutMessage: string;
  selectionStateRef: MutableRefObject<SelectionState>;
  statusRef: MutableRefObject<AnalysisStatus>;
  pendingAccountStatusRef: MutableRefObject<AccountStatus | null>;
  debugFixEnabledRef: MutableRefObject<boolean>;
  setSelectionState: Dispatch<SetStateAction<SelectionState>>;
  setBanner: Dispatch<SetStateAction<BannerState | null>>;
  lifecycle: AnalysisLifecycleBridge;
}

/**
 * Centralises the window.postMessage bridge between the runtime and the App shell.
 */
export function usePluginMessageBridge(config: PluginMessageBridgeConfig): void {
  const {
    defaultCreditsState,
    timeoutMessage,
    selectionStateRef,
    statusRef,
    pendingAccountStatusRef,
    debugFixEnabledRef,
    setSelectionState,
    setBanner,
    lifecycle
  } = config;
  const {
    setIdle,
    setReady,
    beginAnalysis,
    completeAnalysis,
    failAnalysis,
    cancelAnalysis
  } = lifecycle;

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        debugFixEnabledRef.current &&
        (!event.data || !("pluginMessage" in (event.data as Record<string, unknown>)))
      ) {
        const payload = event.data;
        const preview =
          payload && typeof payload === "object"
            ? Object.keys(payload as Record<string, unknown>).slice(0, 8)
            : typeof payload;
        logger.debug("[DEBUG_FIX][AuthBridge] Window message received", {
          origin: event.origin ?? "unknown",
          hasPluginMessage: Boolean((payload as Record<string, unknown> | null)?.pluginMessage),
          keys: preview
        });
      }

      const currentCredits = selectionStateRef.current?.credits ?? defaultCreditsState;
      const authStatusCandidate = extractAuthStatusFromMessage(event.data);

      if (authStatusCandidate) {
        const origin = event.origin ?? "unknown";
        logger.debug("[AuthBridge] Auth status candidate received", {
          candidate: authStatusCandidate,
          origin,
          currentStatus: currentCredits.accountStatus,
          pendingStatus: pendingAccountStatusRef.current
        });
        const normalizedStatus = normalizeAccountStatusFromPayload(
          authStatusCandidate,
          currentCredits.accountStatus
        );

        if (
          normalizedStatus !== currentCredits.accountStatus &&
          normalizedStatus !== pendingAccountStatusRef.current
        ) {
          logger.debug("[AuthBridge] Forwarding normalized account status to runtime", {
            from: currentCredits.accountStatus,
            next: normalizedStatus,
            origin
          });

          pendingAccountStatusRef.current = normalizedStatus;
          parent.postMessage(
            {
              pluginMessage: {
                type: "SYNC_ACCOUNT_STATUS",
                payload: { status: normalizedStatus }
              }
            },
            "*"
          );
        } else {
          logger.debug("[AuthBridge] Ignored auth status message", {
            candidate: authStatusCandidate,
            normalized: normalizedStatus,
            reason:
              normalizedStatus === currentCredits.accountStatus
                ? "matches-current"
                : "duplicate-pending"
          });
        }
      } else {
        const rawType =
          typeof (event.data as Record<string, unknown> | null)?.type === "string"
            ? ((event.data as Record<string, unknown>).type as string).toLowerCase()
            : null;
        if (rawType && AUTH_STATUS_TYPE_MATCHERS.has(rawType)) {
          const payloadValue = (event.data as Record<string, unknown>).payload;
          const payloadKeys =
            payloadValue && typeof payloadValue === "object" && !Array.isArray(payloadValue)
              ? Object.keys(payloadValue as Record<string, unknown>)
              : typeof payloadValue;
          logger.debug("[AuthBridge] Auth message received without status", {
            origin: event.origin ?? "unknown",
            payloadKeys
          });
        }
      }

      const message = event.data?.pluginMessage as PluginToUiMessage | undefined;
      if (!message) {
        return;
      }

      switch (message.type) {
        case "SELECTION_STATUS": {
          logger.debug("[AuthBridge] Selection status payload received", {
            hasSelection: message.payload.hasSelection,
            authPortalUrl: message.payload.authPortalUrl ?? null
          });
          setSelectionState((previous) => {
            const creditsReported = Boolean(message.payload.credits) || previous.creditsReported;
            const normalizedCredits = normalizeCreditsPayload(
              message.payload.credits,
              previous.credits
            );

            const nextCredits = message.payload.credits
              ? { ...normalizedCredits }
              : normalizedCredits;

            return {
              hasSelection: message.payload.hasSelection,
              selectionName: message.payload.selectionName,
              warnings: message.payload.warnings,
              analysisEndpoint: message.payload.analysisEndpoint,
              authPortalUrl:
                message.payload.authPortalUrl && message.payload.authPortalUrl.length > 0
                  ? message.payload.authPortalUrl
                  : previous.authPortalUrl,
              credits: nextCredits,
              creditsReported,
              flow: message.payload.flow
            };
          });
          if (!message.payload.hasSelection) {
            setIdle();
          } else if (statusRef.current === "idle" || statusRef.current === "error") {
            setReady();
          }

          setBanner((previous) => {
            if (message.payload.warnings && message.payload.warnings.length > 0) {
              return {
                intent: "warning",
                message: message.payload.warnings.join(" ")
              };
            }

            if (!message.payload.hasSelection) {
              return null;
            }

            if (previous && (previous.intent === "success" || previous.intent === "notice")) {
              return previous;
            }

            return null;
          });
          break;
        }
        case "PING_RESULT": {
          const ok = message.payload.ok;
          const endpoint = message.payload.endpoint;
          const text = ok
            ? `Connection OK: ${formatEndpoint(endpoint)}`
            : `Connection failed: ${message.payload.message || "Unknown error"}`;
          setBanner({ intent: ok ? "success" : "danger", message: text });
          break;
        }
        case "ANALYSIS_IN_PROGRESS": {
          logger.debug("[UI] Analysis marked in progress", {
            selectionName: message.payload.selectionName,
            frameCount: message.payload.frameCount ?? 1
          });
          beginAnalysis();
          setBanner(null);
          break;
        }
        case "ANALYSIS_RESULT": {
          logger.debug("[UI] Analysis result received", {
            selectionName: message.payload.selectionName,
            frameCount: message.payload.frameCount ?? 1
          });
          completeAnalysis(message.payload);
          setBanner(null);
          break;
        }
        case "ANALYSIS_ERROR": {
          const messageText = message.error || timeoutMessage;
          failAnalysis();
          setBanner({
            intent: "danger",
            message: messageText
          });
          break;
        }
        case "ANALYSIS_CANCELLED": {
          const selectionName = message.payload.selectionName;
          const hasSelection = selectionStateRef.current?.hasSelection ?? false;
          cancelAnalysis(hasSelection);
          setBanner({
            intent: "notice",
            message: selectionName
              ? `Analysis canceled for “${selectionName}”.`
              : "Analysis canceled."
          });
          break;
        }
        default:
          break;
      }
    }

    window.addEventListener("message", onMessage);
    parent.postMessage({ pluginMessage: { type: "UI_READY" } }, "*");

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [
    beginAnalysis,
    cancelAnalysis,
    completeAnalysis,
    debugFixEnabledRef,
    defaultCreditsState,
    failAnalysis,
    pendingAccountStatusRef,
    selectionStateRef,
    setBanner,
    setIdle,
    setReady,
    setSelectionState,
    statusRef,
    timeoutMessage
  ]);
}

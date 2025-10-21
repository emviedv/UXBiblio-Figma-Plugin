import { useCallback, useRef, useState } from "react";
import type { AnalysisResultPayload } from "@shared/types/messages";
import type { AnalysisStatus } from "../types/analysis-status";
import {
  createIdleProgressState,
  recordAnalysisDuration,
  type ProgressState
} from "../utils/analysisHistory";
import { useAnalysisProgressTimer, resetProgressState, stopProgressTimer } from "./useAnalysisProgress";

const ERROR_DURATION_THRESHOLD_MS = 5000;

export interface AnalysisLifecycleApi {
  status: AnalysisStatus;
  analysis: AnalysisResultPayload | null;
  progress: ProgressState;
  setIdle: () => void;
  setReady: () => void;
  setError: () => void;
  clearAnalysis: () => void;
  beginAnalysis: () => void;
  completeAnalysis: (payload: AnalysisResultPayload) => void;
  failAnalysis: (options?: { recordThresholdMs?: number }) => void;
  cancelAnalysis: (hasSelection: boolean) => void;
}

export function useAnalysisLifecycle(): AnalysisLifecycleApi {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [analysis, setAnalysis] = useState<AnalysisResultPayload | null>(null);
  const [progress, setProgress] = useState<ProgressState>(() => createIdleProgressState());
  const analysisStartRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);

  useAnalysisProgressTimer(status, analysisStartRef, progressTimerRef, setProgress);

  const setIdle = useCallback(() => {
    setStatus("idle");
  }, []);

  const setReady = useCallback(() => {
    setStatus("ready");
  }, []);

  const setError = useCallback(() => {
    setStatus("error");
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
  }, []);

  const resetProgress = useCallback(() => {
    analysisStartRef.current = null;
    stopProgressTimer(progressTimerRef);
    resetProgressState(setProgress);
  }, []);

  const beginAnalysis = useCallback(() => {
    setStatus("analyzing");
    if (analysisStartRef.current == null) {
      analysisStartRef.current = Date.now();
    }
  }, []);

  const completeAnalysis = useCallback((payload: AnalysisResultPayload) => {
    setAnalysis(payload);
    setStatus("success");
    if (analysisStartRef.current != null) {
      recordAnalysisDuration(Date.now() - analysisStartRef.current);
    }
    resetProgress();
  }, [resetProgress]);

  const failAnalysis = useCallback(
    ({ recordThresholdMs = ERROR_DURATION_THRESHOLD_MS } = {}) => {
      setStatus("error");
      if (analysisStartRef.current != null) {
        const elapsed = Date.now() - analysisStartRef.current;
        if (elapsed > recordThresholdMs) {
          recordAnalysisDuration(elapsed);
        }
      }
      resetProgress();
    },
    [resetProgress]
  );

  const cancelAnalysis = useCallback(
    (hasSelection: boolean) => {
      setStatus(hasSelection ? "ready" : "idle");
      resetProgress();
    },
    [resetProgress]
  );

  return {
    status,
    analysis,
    progress,
    setIdle,
    setReady,
    setError,
    clearAnalysis,
    beginAnalysis,
    completeAnalysis,
    failAnalysis,
    cancelAnalysis
  };
}

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { AnalysisStatus } from "../types/analysis-status";
import {
  computeProgressState,
  createIdleProgressState,
  type ProgressState
} from "../utils/analysisHistory";

export function useAnalysisProgressTimer(
  status: AnalysisStatus,
  analysisStartRef: MutableRefObject<number | null>,
  progressTimerRef: MutableRefObject<number | null>,
  setProgress: Dispatch<SetStateAction<ProgressState>>
): void {
  useEffect(() => {
    if (status !== "analyzing") {
      if (progressTimerRef.current != null) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      return;
    }

    if (analysisStartRef.current == null) {
      analysisStartRef.current = Date.now();
    }

    setProgress(computeProgressState(analysisStartRef.current));

    const id = window.setInterval(() => {
      setProgress(computeProgressState(analysisStartRef.current));
    }, 1000);

    progressTimerRef.current = id as unknown as number;

    return () => {
      window.clearInterval(id);
      if (progressTimerRef.current === (id as unknown as number)) {
        progressTimerRef.current = null;
      }
    };
  }, [status, analysisStartRef, progressTimerRef, setProgress]);
}

export function stopProgressTimer(timerRef: MutableRefObject<number | null>): void {
  if (timerRef.current != null) {
    window.clearInterval(timerRef.current);
    timerRef.current = null;
  }
}

export function resetProgressState(setProgress: Dispatch<SetStateAction<ProgressState>>): void {
  setProgress(() => createIdleProgressState());
}

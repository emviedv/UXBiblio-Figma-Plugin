import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type UseAnalysisCopyDebugOptions = {
  canCopy: boolean;
  onCopy?: () => Promise<boolean> | boolean;
};

export type UseAnalysisCopyDebugResult = {
  copyFeedback: "idle" | "success" | "error";
  copyButtonDisabled: boolean;
  handleCopyDebugClick: () => Promise<void>;
  showCopyStatus: boolean;
};

export function useAnalysisCopyDebug({
  canCopy,
  onCopy
}: UseAnalysisCopyDebugOptions): UseAnalysisCopyDebugResult {
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "success" | "error">("idle");
  const copyFeedbackTimeoutRef = useRef<number | null>(null);

  const copyButtonDisabled = useMemo(() => !onCopy || !canCopy, [canCopy, onCopy]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current != null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
        copyFeedbackTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!copyButtonDisabled) {
      return;
    }

    if (copyFeedbackTimeoutRef.current != null) {
      window.clearTimeout(copyFeedbackTimeoutRef.current);
      copyFeedbackTimeoutRef.current = null;
    }

    if (copyFeedback !== "idle") {
      setCopyFeedback("idle");
    }
  }, [copyButtonDisabled, copyFeedback]);

  const handleCopyDebugClick = useCallback(async () => {
    if (copyButtonDisabled || !onCopy) {
      return;
    }

    let success = false;
    try {
      const result = await onCopy();
      success = result !== false;
    } catch {
      success = false;
    }

    setCopyFeedback(success ? "success" : "error");

    if (copyFeedbackTimeoutRef.current != null) {
      window.clearTimeout(copyFeedbackTimeoutRef.current);
    }

    copyFeedbackTimeoutRef.current = window.setTimeout(() => {
      setCopyFeedback("idle");
      copyFeedbackTimeoutRef.current = null;
    }, 1800);
  }, [copyButtonDisabled, onCopy]);

  return {
    copyFeedback,
    copyButtonDisabled,
    handleCopyDebugClick,
    showCopyStatus: copyFeedback !== "idle"
  };
}

import { Scan } from "lucide-react";

type AnalysisStatus = "idle" | "ready" | "analyzing" | "cancelling" | "success" | "error";

export function AnalysisControls({
  status,
  analyzeDisabled,
  hasSelection,
  onAnalyze,
  analyzeButtonCopy,
  noSelectionTooltip
}: {
  status: AnalysisStatus;
  analyzeDisabled: boolean;
  hasSelection: boolean;
  onAnalyze: () => void;
  analyzeButtonCopy: string;
  noSelectionTooltip: string;
}): JSX.Element {
  const isAnalyzing = status === "analyzing";
  const isCancelling = status === "cancelling";
  const analyzeLabel = isAnalyzing ? "Analyzing…" : isCancelling ? "Canceling…" : analyzeButtonCopy;
  const tooltip = hasSelection ? analyzeButtonCopy : noSelectionTooltip;

  return (
    <div className="analysis-controls">
      <button
        type="button"
        className="primary-button icon-button"
        onClick={onAnalyze}
        disabled={analyzeDisabled}
        aria-label={analyzeLabel}
        title={tooltip}
      >
        <Scan className="button-icon" aria-hidden="true" />
      </button>
    </div>
  );
}

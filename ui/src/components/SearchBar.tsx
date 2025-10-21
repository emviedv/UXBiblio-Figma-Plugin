type AnalysisStatus = "idle" | "ready" | "analyzing" | "cancelling" | "success" | "error";

export function SearchBar({
  status,
  analyzeDisabled,
  hasSelection,
  onAnalyze,
  analyzeButtonCopy = "Analyze",
  noSelectionTooltip,
  disabledReason
}: {
  status: AnalysisStatus;
  analyzeDisabled: boolean;
  hasSelection: boolean;
  onAnalyze: () => void;
  analyzeButtonCopy?: string;
  noSelectionTooltip: string;
  disabledReason?: string;
}): JSX.Element {
  const isAnalyzing = status === "analyzing";
  const isCancelling = status === "cancelling";
  const analyzeLabel = isAnalyzing ? "Analyzing…" : isCancelling ? "Canceling…" : analyzeButtonCopy;
  const buttonTooltip =
    disabledReason ?? (hasSelection ? analyzeLabel : noSelectionTooltip);

  return (
    <div className="search-section" role="region" aria-label="Search and Analyze">
      <form role="search" className="search-form" onSubmit={(e) => e.preventDefault()}>
        <input
          type="search"
          className="search-input"
          placeholder="Search insights…"
          aria-label="Search insights"
        />
        <button
          type="button"
          className="primary-button"
          onClick={onAnalyze}
          disabled={analyzeDisabled}
          aria-label={analyzeLabel}
          title={buttonTooltip}
        >
          {analyzeLabel}
        </button>
      </form>
    </div>
  );
}

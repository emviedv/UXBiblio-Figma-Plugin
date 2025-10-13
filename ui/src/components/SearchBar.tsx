type AnalysisStatus = "idle" | "ready" | "analyzing" | "cancelling" | "success" | "error";

export function SearchBar({
  status,
  analyzeDisabled,
  hasSelection,
  onAnalyze,
  analyzeButtonCopy = "Analyze",
  noSelectionTooltip
}: {
  status: AnalysisStatus;
  analyzeDisabled: boolean;
  hasSelection: boolean;
  onAnalyze: () => void;
  analyzeButtonCopy?: string;
  noSelectionTooltip: string;
}): JSX.Element {
  const isAnalyzing = status === "analyzing";
  const isCancelling = status === "cancelling";
  const analyzeLabel = isAnalyzing ? "Analyzing…" : isCancelling ? "Canceling…" : analyzeButtonCopy;
  const tooltip = hasSelection ? analyzeButtonCopy : noSelectionTooltip;

  return (
    <div className="search-section" role="region" aria-label="Search and Analyze">
      <form role="search" className="search-form" onSubmit={(e) => e.preventDefault()}>
        <input
          type="search"
          className="search-input"
          placeholder="Search insights…"
          aria-label="Search insights"
        />
      </form>
      <button
        type="button"
        className="primary-button"
        onClick={onAnalyze}
        disabled={analyzeDisabled}
        aria-label={analyzeLabel}
        title={tooltip}
      >
        {analyzeLabel}
      </button>
    </div>
  );
}

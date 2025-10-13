export type UiToPluginMessage =
  | { type: "UI_READY" }
  | { type: "ANALYZE_SELECTION" }
  | { type: "CANCEL_ANALYSIS" }
  | { type: "PING_CONNECTION" }
  | { type: "OPEN_UPGRADE" };

export interface AnalysisResultPayload {
  selectionName: string;
  analysis: unknown;
  metadata?: unknown;
  exportedAt: string;
}

export type PluginToUiMessage =
  | {
      type: "SELECTION_STATUS";
      payload: {
        hasSelection: boolean;
        selectionName?: string;
        warnings?: string[];
        analysisEndpoint?: string;
      };
    }
  | {
      type: "ANALYSIS_IN_PROGRESS";
      payload: { selectionName: string };
    }
  | {
      type: "ANALYSIS_RESULT";
      payload: AnalysisResultPayload;
    }
  | {
      type: "ANALYSIS_ERROR";
      error: string;
    }
  | {
      type: "ANALYSIS_CANCELLED";
      payload: { selectionName: string };
    }
  | {
      type: "PING_RESULT";
      payload: { ok: boolean; endpoint: string; message?: string };
    };

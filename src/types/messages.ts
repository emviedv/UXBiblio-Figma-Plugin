export type AccountStatus = "anonymous" | "trial" | "pro";

export interface CreditsSummary {
  totalFreeCredits: number;
  remainingFreeCredits: number;
  accountStatus: AccountStatus;
}

export interface FlowSelectionSummary {
  frameCount: number;
  frameIds: string[];
  frameNames: string[];
  totalSelected: number;
  nonExportableCount: number;
  limitExceeded: boolean;
  requiredCredits: number;
}

export type UiToPluginMessage =
  | { type: "UI_READY" }
  | { type: "ANALYZE_SELECTION" }
  | { type: "CANCEL_ANALYSIS" }
  | { type: "PING_CONNECTION" }
  | { type: "OPEN_UPGRADE" }
  | { type: "OPEN_AUTH_PORTAL" }
  | { type: "SYNC_ACCOUNT_STATUS"; payload: { status: AccountStatus } };

export interface AnalysisResultPayload {
  selectionName: string;
  analysis: unknown;
  metadata?: unknown;
  exportedAt: string;
  frameCount?: number;
}

export type PluginToUiMessage =
  | {
      type: "SELECTION_STATUS";
      payload: {
        hasSelection: boolean;
        selectionName?: string;
        warnings?: string[];
        analysisEndpoint?: string;
        credits?: CreditsSummary;
        flow?: FlowSelectionSummary;
      };
    }
  | {
      type: "ANALYSIS_IN_PROGRESS";
      payload: { selectionName: string; frameCount?: number };
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
      payload: { selectionName: string; frameCount?: number };
    }
  | {
      type: "PING_RESULT";
      payload: { ok: boolean; endpoint: string; message?: string };
    };

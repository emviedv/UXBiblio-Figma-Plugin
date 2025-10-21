import type { FlowSelectionSummary } from "@shared/types/messages";
import type { CreditsState } from "./authBridge";

export type BannerIntent = "info" | "notice" | "warning" | "danger" | "success";

export interface BannerState {
  intent: BannerIntent;
  message: string;
}

export interface SelectionState {
  hasSelection: boolean;
  selectionName?: string;
  warnings?: string[];
  analysisEndpoint?: string;
  authPortalUrl?: string;
  credits: CreditsState;
  creditsReported: boolean;
  flow?: FlowSelectionSummary;
}

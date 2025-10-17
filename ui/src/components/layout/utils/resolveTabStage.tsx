import type { JSX } from "react";
import { logger } from "@shared/utils/logger";
import type { AnalysisStatus } from "../../../types/analysis-status";
import type { AnalysisTabDescriptor } from "../../../types/analysis-tabs";
import {
  EmptyTabNotice,
  type SkeletonDisplay,
  type SkeletonProgress
} from "../components/AnalysisTabStage";
import { buildSkeletonMessage, type SkeletonStage } from "./buildSkeletonMessage";

export type ResolveTabStageInput = {
  tab: AnalysisTabDescriptor;
  status: AnalysisStatus;
  selectionName?: string;
  selectionLabel: string;
  initialEmptyMessage: string;
  progress?: SkeletonProgress;
  cache: Map<string, JSX.Element | null>;
  skeletonLog: Set<string>;
  shouldShowInitialEmpty: boolean;
};

export type TabStageViewModel = {
  stage: AnalysisStatus;
  body: JSX.Element | null;
  skeleton: SkeletonDisplay | null;
  hasCachedContent: boolean;
  contentState: "active" | "stale" | "void" | "empty" | "initial" | "error" | "live";
};

export function resolveTabStage({
  tab,
  status,
  selectionName,
  selectionLabel,
  initialEmptyMessage,
  progress,
  cache,
  skeletonLog,
  shouldShowInitialEmpty
}: ResolveTabStageInput): TabStageViewModel {
  const isAnalyzing = status === "analyzing";
  const isCancelling = status === "cancelling";
  const isSuccess = status === "success";
  const isError = status === "error";
  const hasRenderableContent = Boolean(tab.hasContent);
  const tabLabel = tab.label?.trim() ?? "";
  const sectionLabel = tabLabel.length > 0 ? tabLabel : "this section";
  const skeletonLabel = tabLabel || tab.label;
  const cacheKey = tab.id;
  const cachedBody = cache.get(cacheKey) ?? null;
  const skeletonContext = { hasNamedSelection: Boolean(selectionName), selectionLabel, sectionLabel };

  let stage: AnalysisStatus = status;
  let body: JSX.Element | null = null;
  let skeleton: SkeletonDisplay | null = null;
  let hasCachedContent = false;
  let contentState: TabStageViewModel["contentState"] = "initial";

  const finalize = (): TabStageViewModel => ({
    stage,
    body,
    skeleton,
    hasCachedContent,
    contentState
  });

  const enterSkeletonState = ({
    skeletonStage,
    logKey,
    logMessage,
    overlaySuffix,
    overlayMessage
  }: {
    skeletonStage: SkeletonStage;
    logKey: string;
    logMessage: string;
    overlaySuffix: SkeletonStage;
    overlayMessage: string;
  }): TabStageViewModel => {
    stage = skeletonStage === "analyzing" ? "analyzing" : "cancelling";
    skeleton = {
      show: true,
      message: buildSkeletonMessage(skeletonStage, skeletonContext),
      tabLabel: skeletonLabel,
      progress
    };

    if (hasRenderableContent && !skeletonLog.has(logKey)) {
      skeletonLog.add(logKey);
      logger.debug(logMessage, { tabId: tab.id, tabLabel });
    }

    const overlayKey = `overlay:${tab.id}:${overlaySuffix}`;
    if (!skeletonLog.has(overlayKey)) {
      skeletonLog.add(overlayKey);
      logger.debug(overlayMessage, { tabId: tab.id, tabLabel, hasCachedBody: Boolean(cachedBody) });
    }

    body = cachedBody;
    hasCachedContent = Boolean(cachedBody);
    contentState = cachedBody ? "stale" : "void";
    return finalize();
  };

  if (shouldShowInitialEmpty) {
    cache.delete(cacheKey);
    body = <EmptyTabNotice title="No frame selected" message={initialEmptyMessage} />;
    contentState = "initial";
    return finalize();
  }

  if (isError) {
    cache.delete(cacheKey);
    stage = "error";
    body = (
      <EmptyTabNotice message="Analysis unavailable. Try again after resolving the issue." />
    );
    contentState = "error";
    return finalize();
  }

  if (isAnalyzing) {
    return enterSkeletonState({
      skeletonStage: "analyzing",
      logKey: tab.id,
      logMessage: "[UI] Deferring tab render while skeleton active",
      overlaySuffix: "analyzing",
      overlayMessage: "[UI] Showing skeleton overlay during analysis"
    });
  }

  if (isCancelling) {
    return enterSkeletonState({
      skeletonStage: "cancelling",
      logKey: `${tab.id}-cancelling`,
      logMessage: "[UI] Holding tab render during cancel",
      overlaySuffix: "cancelling",
      overlayMessage: "[UI] Showing cancellation skeleton overlay"
    });
  }

  if (hasRenderableContent) {
    const renderedBody = tab.render();
    if (renderedBody) {
      cache.set(cacheKey, renderedBody);
      body = renderedBody;
      hasCachedContent = true;
      contentState = "active";
      return finalize();
    }

    logger.warn("[UI] Tab reported content but render() returned null", { tabId: tab.id, status });
    cache.delete(cacheKey);
    body = <EmptyTabNotice message={tab.emptyMessage} />;
    contentState = "empty";
    return finalize();
  }

  if (isSuccess) {
    cache.delete(cacheKey);
    stage = "success";
    body = <EmptyTabNotice message={tab.emptyMessage} />;
    contentState = "empty";
    return finalize();
  }

  cache.delete(cacheKey);
  body = (
    <EmptyTabNotice message={`${selectionLabel} is ready. Run analysis to view insights.`} />
  );
  contentState = "initial";
  return finalize();
}

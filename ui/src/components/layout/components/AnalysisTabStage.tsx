import { useId, type JSX } from "react";
import type { LucideIcon } from "lucide-react";
import { Frame } from "lucide-react";
import type { AnalysisStatus } from "../../../types/analysis-status";

export type SkeletonProgress = {
  determinate: boolean;
  percent?: number | null;
  minutesLeftLabel?: string | null;
};

export type SkeletonDisplay = {
  show: boolean;
  message: string;
  tabLabel?: string;
  progress?: SkeletonProgress;
};

export type TabStageViewProps = {
  stage: AnalysisStatus;
  body: JSX.Element | null;
  skeleton: SkeletonDisplay | null;
  contentState: "active" | "stale" | "void" | "empty" | "initial" | "error" | "live";
  hasCachedContent: boolean;
};

export function TabStageView({
  stage,
  body,
  skeleton,
  contentState,
  hasCachedContent
}: TabStageViewProps): JSX.Element {
  const skeletonVisible = Boolean(skeleton?.show);
  return (
    <div
      className="analysis-tab-stage"
      data-panel-stage={stage}
      data-panel-has-cache={hasCachedContent ? "true" : undefined}
    >
      {skeletonVisible ? (
        <div className="analysis-tab-stage-skeleton" data-skeleton-visible="true">
          <SkeletonTabNotice
            message={skeleton?.message ?? "Analyzing…"}
            progress={skeleton?.progress}
            tabLabel={skeleton?.tabLabel}
          />
        </div>
      ) : null}
      <div
        className="analysis-tab-stage-content"
        data-panel-content-state={contentState}
        data-panel-inert={skeletonVisible && contentState !== "live" ? "true" : undefined}
        aria-hidden={skeletonVisible && contentState !== "live" ? "true" : undefined}
        inert={skeletonVisible && contentState !== "live" ? "" : undefined}
      >
        {body}
      </div>
    </div>
  );
}

export type EmptyTabNoticeProps = {
  message: string;
  title?: string;
  icon?: LucideIcon;
};

export function EmptyTabNotice({
  message,
  title,
  icon: Icon = Frame
}: EmptyTabNoticeProps): JSX.Element {
  return (
    <div className="tab-empty" role="status" aria-live="polite">
      {Icon ? <Icon className="tab-empty-icon" aria-hidden="true" /> : null}
      {title ? <p className="tab-empty-title">{title}</p> : null}
      <p className="tab-empty-message">{message}</p>
    </div>
  );
}

export type SkeletonTabNoticeProps = {
  message: string;
  progress?: SkeletonProgress;
  tabLabel?: string;
};

export function SkeletonTabNotice({
  message,
  progress,
  tabLabel
}: SkeletonTabNoticeProps): JSX.Element {
  const progressLabelId = useId();
  const hasEta =
    Boolean(progress?.determinate) && Boolean(progress?.minutesLeftLabel);

  return (
    <div
      className="tab-empty tab-skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-skeleton="true"
    >
      <Frame className="tab-empty-icon" aria-hidden="true" />
      {tabLabel ? (
        <p className="tab-empty-title" data-skeleton-tab-label="true">
          {tabLabel}
        </p>
      ) : null}
      <p className="tab-empty-message">{message}</p>
      <div className="global-progress" aria-live="polite">
        {progress?.determinate && typeof progress.percent === "number" ? (
          <div
            className="global-progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.max(
              0,
              Math.min(100, Math.round(progress.percent))
            )}
            aria-valuetext={hasEta ? progress.minutesLeftLabel ?? undefined : undefined}
            aria-describedby={hasEta ? progressLabelId : undefined}
          >
            <div
              className="global-progress-fill"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(100, progress.percent ?? 0)
                )}%`
              }}
            />
          </div>
        ) : (
          <div className="global-progress-bar is-indeterminate" aria-hidden="true">
            <div className="global-progress-fill" />
          </div>
        )}
        {hasEta ? (
          <div className="global-progress-callout" id={progressLabelId}>
            ETA: {progress?.minutesLeftLabel}
          </div>
        ) : null}
      </div>
      <div className="skeleton-content" aria-hidden="true">
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
      </div>
    </div>
  );
}

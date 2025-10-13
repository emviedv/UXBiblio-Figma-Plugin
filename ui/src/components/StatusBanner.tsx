import { forwardRef } from "react";

type BannerIntent = "info" | "notice" | "warning" | "danger" | "success";

interface StatusBannerProps {
  intent: BannerIntent;
  message: string;
  hasSelection: boolean;
}

export const StatusBanner = forwardRef<HTMLDivElement, StatusBannerProps>(function StatusBanner(
  { intent, message, hasSelection },
  ref
) {
  const tone = resolveBannerIntent(intent, hasSelection);
  const isAlert = tone === "danger" || tone === "warning";

  return (
    <div
      ref={ref}
      className={`status-banner ${tone}`}
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
      aria-atomic="true"
      tabIndex={isAlert ? -1 : undefined}
    >
      {message}
    </div>
  );
});

function resolveBannerIntent(intent: BannerIntent, hasSelection: boolean): BannerIntent {
  if (intent === "danger" && !hasSelection) {
    return "warning";
  }

  return intent;
}


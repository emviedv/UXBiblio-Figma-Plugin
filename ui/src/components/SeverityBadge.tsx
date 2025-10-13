interface SeverityBadgeProps {
  severity?: string;
  score?: number;
}

export function SeverityBadge({ severity, score }: SeverityBadgeProps): JSX.Element | null {
  const trimmedSeverity = severity?.trim() ?? "";
  const formattedScore = typeof score === "number" ? formatScore(score) : null;
  const label = trimmedSeverity || formattedScore || "";

  if (!label) {
    return null;
  }

  const level = deriveSeverityLevel(trimmedSeverity, score);

  return (
    <span
      className={`severity severity-${level}`}
      title={formattedScore ? `Score ${formattedScore}` : trimmedSeverity}
      data-score={formattedScore ?? undefined}
    >
      {trimmedSeverity && formattedScore ? `${trimmedSeverity} · ${formattedScore}` : label}
    </span>
  );
}

function deriveSeverityLevel(severityLabel: string, score: number | undefined): string {
  if (typeof score === "number" && Number.isFinite(score)) {
    if (score <= 2) {
      return "high";
    }
    if (score <= 3) {
      return "medium";
    }
    return "low";
  }

  const slug = slugifySeverity(severityLabel);
  if (!slug) {
    return "default";
  }

  if (slug === "critical" || slug === "high" || slug === "needs-attention") {
    return "high";
  }
  if (slug === "medium" || slug === "moderate") {
    return "medium";
  }
  if (slug === "low") {
    return "low";
  }

  return slug;
}

function formatScore(score: number): string {
  if (!Number.isFinite(score)) {
    return "";
  }
  const clamped = Math.max(0, Math.min(5, score));
  const rounded = Number.isInteger(clamped) ? clamped.toFixed(0) : clamped.toFixed(1);
  return `${rounded.replace(/\.0$/, "")}/5`;
}

function slugifySeverity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

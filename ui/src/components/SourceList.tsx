import { useMemo } from "react";
import type { AnalysisSource } from "../utils/analysis";
import { CardSection } from "./CardSection";

export function SourceList({
  heading,
  sources,
  className
}: {
  heading?: string;
  sources: AnalysisSource[];
  className?: string;
}): JSX.Element | null {
  if (!sources.length) {
    return null;
  }

  const sectionClassName = ["source-section", className]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return (
    <CardSection title={heading} className={sectionClassName}>
      <ul className="source-list">
        {sources.map((source, index) => (
          <li key={`source-${index}`} className="source-item">
            <SourceListItem source={source} />
          </li>
        ))}
      </ul>
    </CardSection>
  );
}

export function SourceListItem({ source }: { source: AnalysisSource }): JSX.Element {
  const metaParts = useMemo(() => {
    const parts: string[] = [];

    if (source.domainTier) {
      parts.push(source.domainTier.toUpperCase());
    }

    if (typeof source.publishedYear === "number") {
      parts.push(String(source.publishedYear));
    }

    if (source.usedFor) {
      parts.push(source.usedFor);
    }

    return parts;
  }, [source.domainTier, source.publishedYear, source.usedFor]);

  return (
    <div className="source-item-content">
      {source.url ? (
        <a className="source-link link" href={source.url} target="_blank" rel="noreferrer">
          {source.title}
        </a>
      ) : (
        <span className="source-link">{source.title}</span>
      )}
      {metaParts.length > 0 && <span className="source-meta">{metaParts.join(" • ")}</span>}
    </div>
  );
}


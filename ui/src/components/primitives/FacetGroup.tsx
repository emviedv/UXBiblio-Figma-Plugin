import { Badge } from "./Badge";

interface FacetGroupProps {
  title: string;
  items: string[];
  facetKey: "flows" | "industries" | "ui-elements" | "psychology";
  tone?: string;
}

export function FacetGroup({ title, items, facetKey, tone }: FacetGroupProps): JSX.Element | null {
  if (!items.length) {
    return null;
  }

  const badgeTone = tone ?? facetKey;

  return (
    <div className="facet-group" data-facet-group={facetKey}>
      <p className="facet-group-title">{title}</p>
      <div className="facet-group-badges">
        {items.map((item) => (
          <Badge
            key={`${facetKey}-${item}`}
            tone={badgeTone}
            title={item}
            aria-label={`${title}: ${item}`}
          >
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

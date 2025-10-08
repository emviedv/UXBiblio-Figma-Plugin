/**
 * Extract solid fill colors (HEX) from a selection node and its descendants.
 */
export function extractSolidFillHexes(
  node: SceneNode
): Array<{ hex: string; name?: string }> {
  const seen = new Map<string, string | undefined>();

  function visit(current: SceneNode) {
    if ("fills" in current) {
      const fills = current.fills;

      if (Array.isArray(fills)) {
        for (const paint of fills) {
          if (paint?.type !== "SOLID" || paint.visible === false) {
            continue;
          }

          const hex = rgbToHex(paint.color);

          if (!seen.has(hex)) {
            const styleName = resolveFillStyleName(current);
            seen.set(hex, styleName);
          }
        }
      }
    }

    if ("children" in current) {
      for (const child of current.children as readonly SceneNode[]) {
        visit(child);
      }
    }
  }

  visit(node);

  return Array.from(seen.entries()).map(([hex, name]) => ({
    hex,
    name: name ?? undefined
  }));
}

function resolveFillStyleName(node: SceneNode): string | undefined {
  if (!("fillStyleId" in node)) {
    return undefined;
  }

  const styleId = node.fillStyleId;

  if (typeof styleId !== "string" || styleId.length === 0) {
    return undefined;
  }

  try {
    return typeof figma !== "undefined" ? figma.getStyleById(styleId)?.name ?? undefined : undefined;
  } catch {
    return undefined;
  }
}

function rgbToHex(color: RGB): string {
  const r = toHex(color.r);
  const g = toHex(color.g);
  const b = toHex(color.b);
  return `#${r}${g}${b}`;
}

function toHex(value: number): string {
  return Math.round(value * 255)
    .toString(16)
    .padStart(2, "0");
}

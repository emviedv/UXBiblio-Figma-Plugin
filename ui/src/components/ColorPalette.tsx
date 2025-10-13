import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PaletteColor } from "@shared/types/messages";
import { logger } from "@shared/utils/logger";
import { CollapsibleCard } from "./CollapsibleCard";
import { CardSection } from "./CardSection";
import { CopyTooltip } from "./CopyTooltip";
import { CheckIcon } from "./icons/CheckIcon";
import { CopyIcon } from "./icons/CopyIcon";
import { Palette } from "lucide-react";
import { ensurePaletteShades, MAX_PALETTE_COLORS, normalizePaletteColors } from "../utils/color";

const COPY_FEEDBACK_DURATION = 2000;

type ColorPaletteVariant = "card" | "inline";

interface ColorPaletteProps {
  colors: PaletteColor[];
  liveOnly?: boolean;
  variant?: ColorPaletteVariant;
  heading?: string;
}

export function ColorPalette({
  colors,
  liveOnly = false,
  variant = "card",
  heading = "Captured Colors"
}: ColorPaletteProps): JSX.Element | null {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const paletteShades = useMemo(() => {
    return liveOnly ? normalizePaletteColors(colors) : ensurePaletteShades(colors);
  }, [colors, liveOnly]);

  useEffect(() => {
    logger.debug("[UI] ColorPalette render", {
      provided: colors.length,
      rendered: paletteShades.length,
      preview: paletteShades.slice(0, MAX_PALETTE_COLORS)
    });
  }, [colors, paletteShades]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(
    async (hex: string) => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }

      try {
        if (
          typeof navigator !== "undefined" &&
          navigator.clipboard &&
          typeof navigator.clipboard.writeText === "function"
        ) {
          await navigator.clipboard.writeText(hex);
        } else {
          const input = document.createElement("textarea");
          input.value = hex;
          input.setAttribute("readonly", "");
          input.style.position = "absolute";
          input.style.opacity = "0";
          document.body.appendChild(input);
          input.select();
          document.execCommand("copy");
          document.body.removeChild(input);
        }

        setCopiedHex(hex);
        resetTimerRef.current = window.setTimeout(() => {
          setCopiedHex((current) => (current === hex ? null : current));
          resetTimerRef.current = null;
        }, COPY_FEEDBACK_DURATION);
      } catch (error) {
        logger.warn("[UI] Failed to copy hex value", { hex, error });
        setCopiedHex(null);
      }
    },
    []
  );

  if (paletteShades.length === 0) {
    return null;
  }

  const swatchGrid = (
    <div className="palette-grid">
      {paletteShades.map((color, index) => (
        <CardSection key={`${color.hex}-${index}`} className="palette-swatch">
          <span className="swatch" style={{ backgroundColor: color.hex }} aria-hidden />
          <div className="swatch-meta">
            <span className="swatch-hex">{color.hex}</span>
            <button
              type="button"
              className={`swatch-copy-button${copiedHex === color.hex ? " copied" : ""}`}
              onClick={() => handleCopy(color.hex)}
              aria-label={`Copy ${color.hex} to clipboard`}
              title={copiedHex === color.hex ? "Copied" : "Copy hex value"}
            >
              {copiedHex === color.hex ? (
                <CheckIcon className="swatch-copy-icon" />
              ) : (
                <CopyIcon className="swatch-copy-icon" />
              )}
            </button>
          </div>
          {color.name && <span className="swatch-name">{color.name}</span>}
          {copiedHex === color.hex && <CopyTooltip />}
        </CardSection>
      ))}
    </div>
  );

  if (variant === "inline") {
    return (
      <div className="palette-inline" data-ux-section="summary-palette">
        {heading ? <h3 className="summary-section-title">{heading}</h3> : null}
        {swatchGrid}
      </div>
    );
  }

  return (
    <CollapsibleCard title={heading} icon={Palette}>
      {swatchGrid}
    </CollapsibleCard>
  );
}

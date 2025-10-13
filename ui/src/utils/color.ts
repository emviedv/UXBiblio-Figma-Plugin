import type { PaletteColor } from "@shared/types/messages";

export const MAX_PALETTE_COLORS = 5;
export const PALETTE_SHADE_OFFSETS = [-0.28, -0.14, 0, 0.14, 0.28];
export const PALETTE_SHADE_SLOT_ORDER = [2, 3, 1, 4, 0];
export const DEFAULT_PALETTE_COLOR: PaletteColor = {
  hex: "#D75695",
  name: "UXBiblio Pink"
};

export function ensurePaletteShades(input: PaletteColor[]): PaletteColor[] {
  const sanitized = normalizePaletteColors(input);
  if (sanitized.length >= MAX_PALETTE_COLORS) {
    return sanitized.slice(0, MAX_PALETTE_COLORS);
  }

  const baseColor = sanitized[0] ?? DEFAULT_PALETTE_COLOR;
  const generated: PaletteColor[] = PALETTE_SHADE_OFFSETS.map((offset, index) => ({
    hex: adjustHexLightness(baseColor.hex, offset),
    name:
      baseColor.name && offset !== 0
        ? `${baseColor.name} shade ${index + 1}`
        : baseColor.name || undefined
  }));

  const slots = PALETTE_SHADE_SLOT_ORDER.slice(0, sanitized.length);
  sanitized.forEach((color, index) => {
    const slot = slots[index] ?? index;
    generated[slot] = color;
  });

  const deduped: PaletteColor[] = [];
  const seen = new Set<string>();
  for (const swatch of generated) {
    const normalizedHex = normalizeHex(swatch.hex);
    if (!normalizedHex || seen.has(normalizedHex)) {
      continue;
    }
    seen.add(normalizedHex);
    deduped.push({ hex: normalizedHex, name: swatch.name });
    if (deduped.length === MAX_PALETTE_COLORS) {
      return deduped;
    }
  }

  let adjustmentIteration = 0;
  while (deduped.length < MAX_PALETTE_COLORS) {
    const offsetIndex = deduped.length % PALETTE_SHADE_OFFSETS.length;
    const baseOffset = PALETTE_SHADE_OFFSETS[offsetIndex];
    const jitterMagnitude = 0.04 * (Math.floor(adjustmentIteration / 2) + 1);
    const jitter = (adjustmentIteration % 2 === 0 ? 1 : -1) * jitterMagnitude;
    const candidateHex = adjustHexLightness(baseColor.hex, baseOffset + jitter) ?? baseColor.hex;
    const normalizedHex = normalizeHex(candidateHex);
    adjustmentIteration += 1;
    if (!normalizedHex || seen.has(normalizedHex)) {
      continue;
    }
    seen.add(normalizedHex);
    deduped.push({
      hex: normalizedHex,
      name: baseColor.name ? `${baseColor.name} shade ${deduped.length}` : `Shade ${deduped.length}`
    });
  }

  return deduped.slice(0, MAX_PALETTE_COLORS);
}

export function normalizePaletteColors(input: PaletteColor[]): PaletteColor[] {
  const seen = new Set<string>();
  const normalized: PaletteColor[] = [];

  for (const color of input) {
    const normalizedHex = normalizeHex(color?.hex);
    if (!normalizedHex || seen.has(normalizedHex)) {
      continue;
    }
    seen.add(normalizedHex);
    normalized.push({ hex: normalizedHex, name: color?.name?.trim() || undefined });
    if (normalized.length === MAX_PALETTE_COLORS) {
      break;
    }
  }

  return normalized;
}

export function normalizeHex(value?: string): string | null {
  if (!value) {
    return null;
  }
  let hex = value.trim();
  if (!hex) {
    return null;
  }
  if (hex.startsWith("#")) {
    hex = hex.slice(1);
  }
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (!/^[\da-f]{6}$/i.test(hex)) {
    return null;
  }
  return `#${hex.toUpperCase()}`;
}

export function adjustHexLightness(hex: string, offset: number): string {
  const normalizedHex = normalizeHex(hex) ?? DEFAULT_PALETTE_COLOR.hex;
  const { h, s, l } = hexToHsl(normalizedHex);
  const nextLightness = clamp01(l + offset);
  const { r, g, b } = hslToRgb(h, s, nextLightness);
  return rgbToHex(r, g, b);
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / delta + 2;
        break;
      default:
        h = (rNorm - gNorm) / delta + 4;
        break;
    }
    h /= 6;
  }

  return { h, s, l };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) {
    const value = Math.round(l * 255);
    return { r: value, g: value, b: value };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hueToRgb(p, q, h + 1 / 3);
  const g = hueToRgb(p, q, h);
  const b = hueToRgb(p, q, h - 1 / 3);

  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

export function hueToRgb(p: number, q: number, t: number): number {
  let tempT = t;
  if (tempT < 0) tempT += 1;
  if (tempT > 1) tempT -= 1;
  if (tempT < 1 / 6) return p + (q - p) * 6 * tempT;
  if (tempT < 1 / 2) return q;
  if (tempT < 2 / 3) return p + (q - p) * (2 / 3 - tempT) * 6;
  return p;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalizedHex = normalizeHex(hex) ?? "#000000";
  const value = parseInt(normalizedHex.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

export function componentToHex(value: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, "0").toUpperCase();
}

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

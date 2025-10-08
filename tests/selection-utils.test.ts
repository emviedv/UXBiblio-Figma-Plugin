import { describe, expect, it, beforeEach, vi } from "vitest";
import type { SceneNode, SolidPaint } from "@figma/plugin-typings";

declare global {
  // Minimal figma stub for unit tests.
  // eslint-disable-next-line no-var
  var figma: {
    getStyleById: (id: string) => { name?: string } | null;
  };
}

describe("selection utilities", () => {
  beforeEach(() => {
    globalThis.figma = {
      getStyleById: vi.fn(() => ({ name: "Primary / Blue 500" }))
    };
  });

  it("extracts unique solid fill hex values from nested nodes", async () => {
    const { extractSolidFillHexes } = await import("@shared/utils/colors");

    const selection = frameNode({
      fillStyleId: "STYLE_PRIMARY",
      fills: [solidPaint({ r: 1, g: 0, b: 0 })],
      children: [
        rectangleNode({
          fillStyleId: "STYLE_PRIMARY",
          fills: [solidPaint({ r: 0, g: 1, b: 0 }), solidPaint({ r: 1, g: 0, b: 0 })]
        }),
        groupNode({
          children: [
            rectangleNode({
              fillStyleId: "STYLE_PRIMARY",
              fills: [solidPaint({ r: 0, g: 0, b: 1 })]
            })
          ]
        })
      ]
    });

    const swatches = extractSolidFillHexes(selection as unknown as SceneNode);

    expect(swatches).toEqual([
      { hex: "#ff0000", name: "Primary / Blue 500" },
      { hex: "#00ff00", name: "Primary / Blue 500" },
      { hex: "#0000ff", name: "Primary / Blue 500" }
    ]);
  });

  it("omits invisible or unsupported paints", async () => {
    const { extractSolidFillHexes } = await import("@shared/utils/colors");

    const selection = frameNode({
      fillStyleId: "STYLE_PRIMARY",
      fills: [
        solidPaint({ r: 1, g: 1, b: 1 }, { visible: false }),
        gradientPaint()
      ],
      children: [
        rectangleNode({
          fillStyleId: "STYLE_PRIMARY",
          fills: [solidPaint({ r: 0.2, g: 0.2, b: 0.2 })]
        })
      ]
    });

    const swatches = extractSolidFillHexes(selection as unknown as SceneNode);

    expect(swatches).toEqual([{ hex: "#333333", name: "Primary / Blue 500" }]);
  });
});

type MutableSceneNode = {
  type: SceneNode["type"];
  fills?: readonly Paint[];
  children?: Array<MutableSceneNode>;
  name?: string;
  fillStyleId?: string;
};

function frameNode(overrides: Partial<MutableSceneNode> = {}): MutableSceneNode {
  return {
    type: "FRAME",
    fills: [],
    children: [],
    ...overrides
  };
}

function rectangleNode(overrides: Partial<MutableSceneNode> = {}): MutableSceneNode {
  return {
    type: "RECTANGLE",
    fills: [],
    children: [],
    ...overrides
  };
}

function groupNode(overrides: Partial<MutableSceneNode> = {}): MutableSceneNode {
  return {
    type: "GROUP",
    fills: [],
    children: [],
    ...overrides
  };
}

function solidPaint(
  color: { r: number; g: number; b: number },
  options: Partial<SolidPaint> = {}
): SolidPaint {
  return {
    type: "SOLID",
    visible: true,
    opacity: 1,
    blendMode: "NORMAL",
    color,
    ...options
  };
}

function gradientPaint(): Paint {
  return {
    type: "GRADIENT_LINEAR",
    gradientStops: [],
    gradientTransform: [
      [1, 0, 0],
      [0, 1, 0]
    ],
    opacity: 1,
    blendMode: "NORMAL"
  };
}

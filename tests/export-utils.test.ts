import { describe, expect, it, vi } from "vitest";

describe("export utilities", () => {
  it("exports selection as base64 JPG at scale 1", async () => {
    const { exportSelectionToBase64 } = await import("@shared/utils/export");

    const exportAsync = vi.fn(async () => new Uint8Array([72, 73])); // "HI"
    const selection = { exportAsync } as unknown as SceneNode;

    const result = await exportSelectionToBase64(selection);

    expect(exportAsync).toHaveBeenCalledWith({
      format: "JPG",
      constraint: { type: "SCALE", value: 1 },
      contentsOnly: false,
      useAbsoluteBounds: true
    });
    expect(result).toBe("SEk=");
  });

  it("throws descriptive error when export fails", async () => {
    const { exportSelectionToBase64 } = await import("@shared/utils/export");

    const exportAsync = vi
      .fn()
      .mockRejectedValue(new Error("Figma export failed"));
    const selection = { exportAsync } as unknown as SceneNode;

    await expect(exportSelectionToBase64(selection)).rejects.toThrow(
      "Unable to export selection. Try simplifying the layer or retrying."
    );
  });
});

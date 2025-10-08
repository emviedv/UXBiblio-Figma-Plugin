const EXPORT_SETTINGS: ExportSettings = {
  format: "JPG",
  constraint: { type: "SCALE", value: 1 },
  contentsOnly: false,
  useAbsoluteBounds: true
};

type ExportableNode = SceneNode & {
  exportAsync: (settings?: ExportSettings) => Promise<Uint8Array>;
};

const EXPORT_ERROR_MESSAGE =
  "Unable to export selection. Try simplifying the layer or retrying.";

export async function exportSelectionToBase64(node: ExportableNode): Promise<string> {
  try {
    const bytes = await node.exportAsync(EXPORT_SETTINGS);
    return uint8ArrayToBase64(bytes);
  } catch {
    throw new Error(EXPORT_ERROR_MESSAGE);
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return typeof btoa === "function" ? btoa(binary) : base64Encode(binary);
}

function base64Encode(binary: string): string {
  if (typeof window !== "undefined" && "btoa" in window) {
    return window.btoa(binary);
  }

  const base64Chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  let result = "";
  let index = 0;

  while (index < binary.length) {
    const chr1 = binary.charCodeAt(index++);
    const chr2 = binary.charCodeAt(index++);
    const chr3 = binary.charCodeAt(index++);

    const enc1 = chr1 >> 2;
    const enc2 = ((chr1 & 3) << 4) | ((chr2 || 0) >> 4);
    const enc3 = Number.isNaN(chr2)
      ? 64
      : ((chr2 & 15) << 2) | ((chr3 || 0) >> 6);
    const enc4 = Number.isNaN(chr3) ? 64 : (chr3 || 0) & 63;

    result +=
      base64Chars.charAt(enc1) +
      base64Chars.charAt(enc2) +
      (enc3 === 64 ? "=" : base64Chars.charAt(enc3)) +
      (enc4 === 64 ? "=" : base64Chars.charAt(enc4));
  }

  return result;
}

function tryParseJson(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function extractStructuredResponse(payload) {
  const result = {
    analysis: undefined,
    raw: undefined,
    contentTypes: []
  };

  if (!payload || typeof payload !== "object") {
    return result;
  }

  const firstChoice = Array.isArray(payload.choices) ? payload.choices[0] : undefined;
  const messageContent = firstChoice?.message?.content;

  if (typeof messageContent === "string") {
    result.raw = messageContent;
    result.contentTypes = ["string"];
    result.analysis = tryParseJson(messageContent);
    return result;
  }

  if (Array.isArray(messageContent)) {
    const contentTypes = [];

    for (const part of messageContent) {
      const partType = typeof part === "object" && part !== null ? part.type ?? "object" : typeof part;
      contentTypes.push(partType);

      if (typeof part?.text === "string" && part.text.trim().length > 0) {
        if (!result.raw) {
          result.raw = part.text;
        }

        if (!result.analysis) {
          result.analysis = tryParseJson(part.text);
        }
      }
    }

    result.contentTypes = contentTypes;
    return result;
  }

  return result;
}

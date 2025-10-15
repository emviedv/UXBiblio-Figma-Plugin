import { describe, expect, it } from "vitest";
import { sanitizeRecommendationText } from "../../utils/analysis/recommendations";

describe("sanitizeRecommendationText — priority metadata", () => {
  it("preserves the immediate bucket tag when metadata includes a colon", () => {
    const input = "[Immediate: high] Add confirmation details to reassure the customer.";
    const sanitized = sanitizeRecommendationText(input);
    expect(sanitized.startsWith("[Immediate]")).toBe(true);
  });

  it("preserves the long-term bucket tag when metadata includes a colon", () => {
    const input = "[Long-term: backlog] Standardize the success overlay template.";
    const sanitized = sanitizeRecommendationText(input);
    expect(sanitized.startsWith("[Long-term]")).toBe(true);
  });
});

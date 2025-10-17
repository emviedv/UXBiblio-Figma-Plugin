import assert from "node:assert/strict";
import test from "node:test";

import { ENHANCED_ANALYSIS_SYSTEM_PROMPT } from "../enhanced-analysis-prompt.mjs";

test("prompt highlights strict compliance rules for anchors and refs", () => {
  assert.match(
    ENHANCED_ANALYSIS_SYSTEM_PROMPT,
    /STRICT COMPLIANCE RULES \(NO EXCEPTIONS\)/,
    "Expected strict compliance section to be present."
  );

  assert.match(
    ENHANCED_ANALYSIS_SYSTEM_PROMPT,
    /\[Refs: heuristics\[#\], WCAG <id>, impact:<category>, OBS-#\]/,
    "Recommendation format instructions should spell out the refs contract."
  );

  assert.match(
    ENHANCED_ANALYSIS_SYSTEM_PROMPT,
    /Risk: Trial candidates may abandon when reassurance appears only after the CTA \(OBS-12, OBS-18 \| flow:onboarding\)\./,
    "Example heuristic insight should demonstrate dual anchors and flow tagging."
  );
});

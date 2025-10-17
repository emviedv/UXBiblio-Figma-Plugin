import assert from "node:assert/strict";
import test from "node:test";

import { ENHANCED_ANALYSIS_SYSTEM_PROMPT } from "../enhanced-analysis-prompt.mjs";

let originalConsoleError;

test.before(() => {
  originalConsoleError = console.error;
  console.error = (...args) => {
    originalConsoleError?.(...args);
    throw new Error(
      `Unexpected console.error during enhanced-analysis-prompt uxSignals contract test: ${args
        .map((value) => String(value))
        .join(" ")}`
    );
  };
});

test.after(() => {
  if (originalConsoleError) {
    console.error = originalConsoleError;
  }
});

test("prompt contract includes uxSignals guidance and JSON example field", () => {
  assert.match(
    ENHANCED_ANALYSIS_SYSTEM_PROMPT,
    /\buxSignals\b/,
    "Expected prompt contract to mention uxSignals guidance."
  );

  assert.match(
    ENHANCED_ANALYSIS_SYSTEM_PROMPT,
    /"uxSignals"\s*:\s*\[/,
    'Expected prompt contract to include a `"uxSignals": [...]` example in the JSON schema.'
  );

  assert.doesNotMatch(
    ENHANCED_ANALYSIS_SYSTEM_PROMPT,
    /"colors"\s*:\s*\[/,
    "Prompt JSON contract should no longer advertise a colors array."
  );
});

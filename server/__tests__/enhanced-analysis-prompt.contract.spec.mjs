import assert from "node:assert/strict";
import test from "node:test";

import { ENHANCED_ANALYSIS_SYSTEM_PROMPT } from "../enhanced-analysis-prompt.mjs";

let originalConsoleError;

test.before(() => {
  originalConsoleError = console.error;
  console.error = (...args) => {
    originalConsoleError?.(...args);
    throw new Error(
      `Unexpected console.error during enhanced-analysis-prompt contract test: ${args
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

test("prompt contract includes uxCopywriting instructions", () => {
  assert.match(
    ENHANCED_ANALYSIS_SYSTEM_PROMPT,
    /"uxCopywriting"\s*:/,
    'Expected prompt contract to include "uxCopywriting" root key example'
  );
});

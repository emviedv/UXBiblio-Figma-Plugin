import assert from "node:assert/strict";
import test from "node:test";

import { extractStructuredResponse } from "../response-parser.mjs";

test("extractStructuredResponse parses output_text content arrays", () => {
  const upstreamPayload = {
    choices: [
      {
        message: {
          content: [
            {
              type: "output_text",
              text: '{"analysis":{"heuristics":[{"title":"Recoverability","description":"OBS-1 + OBS-2"}]}}'
            }
          ]
        }
      }
    ]
  };

  const result = extractStructuredResponse(upstreamPayload);

  assert.equal(result.analysis?.analysis?.heuristics?.[0]?.title, "Recoverability");
  assert.deepEqual(result.contentTypes, ["output_text"]);
});

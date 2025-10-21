import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "../../..");

describe("characterization: manifest + configuration baselines", () => {
  const manifestPath = resolve(repoRoot, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  it("exposes expected plugin metadata", () => {
    expect(manifest.name).toBe("UXBiblio – AI-Powered UX Analysis & Heuristic Evaluator");
    expect(manifest.id).toBe("uxbiblio-analyzer");
    expect(manifest.api).toBe("1.0.0");
  });

  it("points to built assets in dist/", () => {
    expect(manifest.main).toBe("dist/main.js");
    expect(manifest.ui).toBe("dist/ui/index.html");
    expect(manifest.editorType).toEqual(["figma"]);
  });

  it("documents required secrets in .env.example", () => {
    const envExample = readFileSync(resolve(repoRoot, ".env.example"), "utf8");
    expect(envExample).toMatch(/OPENAI_API_KEY=/);
    expect(envExample).toMatch(/OPENAI_BASE_URL=/);
  });
});

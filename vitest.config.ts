import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/setup/console-guard.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "ui/src/__tests__/**/*.spec.tsx"],
    coverage: {
      enabled: false,
      reporter: ["text", "html"],
      include: ["src/**/*.ts", "ui/src/**/*.tsx"],
      exclude: ["src/ui/**"]
    }
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src")
    }
  }
});

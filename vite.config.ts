import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "ui",
  base: "./",
  plugins: [react()],
  esbuild: {
    target: "es2018",
    supported: {
      "nullish-coalescing": false,
      "object-rest-spread": false
    }
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src")
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["ui/src/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true
  },
  build: {
    outDir: "../dist/ui",
    emptyOutDir: true,
    sourcemap: true,
    target: "es2018",
    rollupOptions: {
      input: resolve(__dirname, "ui/index.html")
    }
  },
  server: {
    port: 5173,
    open: true,
    fs: {
      allow: [resolve(__dirname)]
    }
  }
});

import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  test: {
    // Pure TypeScript only: formatters, polling logic, reducers. No React Native renderer.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

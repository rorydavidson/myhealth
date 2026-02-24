import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    passWithNoTests: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@health-app/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
    coverage: {
      provider: "v8",
      include: ["src/services/**/*.ts"],
      exclude: ["src/services/__tests__/**"],
    },
  },
});

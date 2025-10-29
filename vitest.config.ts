import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true, // Enable global test APIs (describe, test, expect)
    environment: "node",
    include: [
      "test/**/*.test.ts",
      "test-app/extensions/*/tests/**/*.test.js",
    ],
    exclude: [
      ...(process.env.CI === "true" ? ["test-app/**"] : []),
      "**/node_modules/**",
      "**/dist/**",
      "**/target/**",
    ],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["**/node_modules/**", "**/test/**"],
    },
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: false,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/index.ts", "src/core.ts", "src/navigation.ts", "src/focus.ts", "src/selection.ts", "src/patterns.ts", "src/utils.ts"],
      reporter: ["text", "lcov"],
    },
  },
});

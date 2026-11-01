import { defineConfig } from "tsup";

const shared = {
  dts: true,
  sourcemap: false,
  clean: false,
  minify: false,
  target: "es2020",
  platform: "neutral" as const,
  treeshake: true,
};

const entries = {
  index: "src/index.ts",
  core: "src/core.ts",
  navigation: "src/navigation.ts",
  focus: "src/focus.ts",
  selection: "src/selection.ts",
  patterns: "src/patterns.ts",
  utils: "src/utils.ts",
};

export default defineConfig([
  {
    ...shared,
    entry: entries,
    format: ["esm"],
    splitting: true,
    clean: true,
    outExtension: () => ({ js: ".js" }),
  },
  {
    ...shared,
    entry: entries,
    format: ["cjs"],
    splitting: false,
    outExtension: () => ({ js: ".cjs" }),
  },
  {
    ...shared,
    entry: { index: "src/index.ts" },
    format: ["iife"],
    dts: false,
    minify: true,
    splitting: false,
    globalName: "Keystra",
    outExtension: () => ({ js: ".global.js" }),
  },
]);

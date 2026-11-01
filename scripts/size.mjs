#!/usr/bin/env node
import { build } from "esbuild";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const scenarios = [
  {
    name: "core (createKeystra only)",
    file: "core-only.mjs",
    code: `import { createKeystra } from "keystra";\nexport const make = (o) => createKeystra(o);\n`,
  },
  {
    name: "core, deep import",
    file: "core-deep.mjs",
    code: `import { createKeystra } from "keystra/core";\nexport const make = (o) => createKeystra(o);\n`,
  },
  {
    name: "createKeyBinding only",
    file: "binding.mjs",
    code: `import { createKeyBinding } from "keystra";\nexport const make = (k, h) => createKeyBinding(k, h);\n`,
  },
  {
    name: "roving focus pattern",
    file: "roving.mjs",
    code: `import { createRovingFocus } from "keystra/patterns";\nexport const make = (o) => createRovingFocus(o);\n`,
  },
  {
    name: "menu pattern",
    file: "menu.mjs",
    code: `import { createMenu } from "keystra/patterns";\nexport const make = (o) => createMenu(o);\n`,
  },
  {
    name: "grid pattern",
    file: "grid.mjs",
    code: `import { createGrid } from "keystra/patterns";\nexport const make = (o) => createGrid(o);\n`,
  },
  {
    name: "everything",
    file: "everything.mjs",
    code: `export * from "keystra";\n`,
  },
];

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(2)} kB`;
}

async function measure(code, file, tmp) {
  const entry = join(tmp, file);
  await writeFile(entry, code, "utf8");
  const outfile = join(tmp, `${file}.out.js`);
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    minify: true,
    format: "esm",
    target: "es2020",
    platform: "browser",
    treeShaking: true,
    absWorkingDir: root,
    nodePaths: [join(root, "node_modules")],
    alias: {
      keystra: join(dist, "index.js"),
      "keystra/core": join(dist, "core.js"),
      "keystra/patterns": join(dist, "patterns.js"),
      "keystra/navigation": join(dist, "navigation.js"),
      "keystra/focus": join(dist, "focus.js"),
      "keystra/selection": join(dist, "selection.js"),
      "keystra/utils": join(dist, "utils.js"),
    },
    logLevel: "silent",
  });
  const bundled = await readFile(outfile);
  return {
    raw: bundled.byteLength,
    gzip: gzipSync(bundled, { level: 9 }).byteLength,
    brotli: brotliCompressSync(bundled).byteLength,
  };
}

async function measureFile(path) {
  const source = await readFile(path);
  return {
    raw: source.byteLength,
    gzip: gzipSync(source, { level: 9 }).byteLength,
    brotli: brotliCompressSync(source).byteLength,
  };
}

const tmp = await mkdtemp(join(tmpdir(), "keystra-size-"));
try {
  const rows = [];
  for (const scenario of scenarios) {
    rows.push({ name: scenario.name, ...(await measure(scenario.code, scenario.file, tmp)) });
  }

  try {
    rows.push({ name: "dist/index.global.js (IIFE)", ...(await measureFile(join(dist, "index.global.js"))) });
  } catch {
  }

  const width = Math.max(...rows.map((r) => r.name.length), 22);
  console.log("");
  console.log(`${"Scenario".padEnd(width)}  ${"minified".padStart(10)}  ${"gzip".padStart(9)}  ${"brotli".padStart(9)}`);
  console.log(`${"-".repeat(width)}  ${"-".repeat(10)}  ${"-".repeat(9)}  ${"-".repeat(9)}`);
  for (const row of rows) {
    console.log(
      `${row.name.padEnd(width)}  ${fmt(row.raw).padStart(10)}  ${fmt(row.gzip).padStart(9)}  ${fmt(row.brotli).padStart(9)}`,
    );
  }
  console.log("");
  console.log("Reproduce with: npm run size");
} finally {
  await rm(tmp, { recursive: true, force: true });
}

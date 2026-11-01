import { execSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const pkg = JSON.parse(await readFile('package.json','utf8'));
const require = createRequire(import.meta.url);
for (const [path, mapping] of Object.entries(pkg.exports)) {
  const specifier = path === '.' ? pkg.name : pkg.name + path.slice(1);
  if (typeof mapping === 'string') { await access(mapping); continue; }
  const checkFiles = async value => { if (typeof value === 'string') await access(value); else for (const child of Object.values(value)) await checkFiles(child); };
  await checkFiles(mapping);
  const esm = await import(specifier); const cjs = require(specifier);
  if (!Object.keys(esm).length || !Object.keys(cjs).length) throw new Error(`Empty entry: ${specifier}`);
  console.log(`OK: ${specifier} (ESM + CJS, Node without DOM)`);
}
const packed = JSON.parse(execSync('npm pack --dry-run --json --ignore-scripts',{encoding:'utf8'}));
const files = packed[0].files.map(f=>f.path);
for (const required of ['README.md','LICENSE','dist/index.js','dist/index.cjs','dist/index.d.ts']) if (!files.includes(required)) throw new Error(`Missing packed file: ${required}`);
if (files.some(f=>/^(src|tests|node_modules)\//.test(f))) throw new Error('Unexpected development files in package');
console.log(`OK: npm pack includes ${files.length} files, ${packed[0].size} bytes compressed`);

#!/usr/bin/env node
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const keystra = join(root, "dist", "index.js").replaceAll("\\", "/");

async function bundle(code, minify) {
  const result = await build({
    stdin: { contents: code, resolveDir: root },
    bundle: true,
    minify,
    write: false,
    format: "iife",
    target: "es2020",
    logLevel: "silent",
  });
  return result.outputFiles[0].contents;
}

const libraries = {
  "keystra createRovingFocus": `import { createRovingFocus as x } from "${keystra}"; window.x = x;`,
  "keystra createKeystra": `import { createKeystra as x } from "${keystra}"; window.x = x;`,
  "keystra createKeyBinding": `import { createKeyBinding as x } from "${keystra}"; window.x = x;`,
  "roving-ux": `import { rovingIndex as x } from "roving-ux"; window.x = x;`,
  tinykeys: `import { tinykeys as x } from "tinykeys"; window.x = x;`,
  "hotkeys-js": `import x from "hotkeys-js"; window.x = x;`,
};

console.log("Package size for one import, minified with esbuild\n");
console.log("library".padEnd(28) + "minified".padStart(11) + "gzip".padStart(11));
for (const [name, code] of Object.entries(libraries)) {
  const output = await bundle(code, true);
  const kb = (bytes) => `${(bytes / 1024).toFixed(2)} kB`;
  console.log(name.padEnd(28) + kb(output.byteLength).padStart(11) + kb(gzipSync(output, { level: 9 }).byteLength).padStart(11));
}

const script = await bundle(
  `import { createRovingFocus, createKeyBinding } from "${keystra}";
   import { rovingIndex } from "roving-ux";
   import { tinykeys } from "tinykeys";
   import hotkeys from "hotkeys-js";
   window.libs = { createRovingFocus, createKeyBinding, rovingIndex, tinykeys, hotkeys };`,
  false,
);

const inPage = () => {
  const { createRovingFocus, createKeyBinding, rovingIndex, tinykeys, hotkeys } = window.libs;
  const key = (code = "ArrowRight") => new KeyboardEvent("keydown", {
    key: code, code, keyCode: 39, which: 39, bubbles: true, cancelable: true,
  });

  function makeGroup(count) {
    const group = document.createElement("div");
    for (let i = 0; i < count; i++) {
      const button = document.createElement("button");
      button.textContent = `item ${i}`;
      button.dataset.keystraItem = "";
      group.append(button);
    }
    document.body.append(group);
    return group;
  }

  function native(group) {
    const items = Array.from(group.children);
    let index = 0;
    items.forEach((item, i) => item.setAttribute("tabindex", i === 0 ? "0" : "-1"));
    const listener = (event) => {
      if (event.key !== "ArrowRight") return;
      items[index].setAttribute("tabindex", "-1");
      index = (index + 1) % items.length;
      items[index].setAttribute("tabindex", "0");
      items[index].focus();
      event.preventDefault();
    };
    group.addEventListener("keydown", listener);
    return () => group.removeEventListener("keydown", listener);
  }

  const keystraGroup = (observe) => (group) => {
    const instance = createRovingFocus({ container: group, items: "button", loop: true, observe, mode: "horizontal" });
    instance.refresh();
    return () => instance.destroy();
  };

  const contenders = {
    "native baseline": native,
    "roving-ux": (group) => {
      rovingIndex({ element: group, target: "button" });
      return () => {};
    },
    keystra: keystraGroup(false),
    "keystra observe": keystraGroup(true),
  };

  const median = (values) => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const timed = (fn) => {
    const start = performance.now();
    fn();
    return performance.now() - start;
  };

  window.bench = {
    contenders: Object.keys(contenders),
    prepare(name, count) {
      const group = makeGroup(count);
      this.group = group;
      this.name = name;
    },
    create() {
      this.destroy = null;
      const init = timed(() => { this.destroy = contenders[this.name](this.group); });
      return init;
    },
    press(times) {
      const samples = [];
      const first = this.group.querySelector("button");
      first.focus();
      for (let i = 0; i < times; i++) {
        samples.push(timed(() => document.activeElement.dispatchEvent(key())));
      }
      const moved = document.activeElement !== first;
      return { median: median(samples), moved };
    },
    clear() {
      this.destroy?.();
      this.group.remove();
      this.group = null;
      this.destroy = null;
    },
    concurrent(name, instances) {
      const groups = [];
      for (let i = 0; i < instances; i++) groups.push(makeGroup(10));
      const destroyers = [];
      const init = timed(() => { for (const group of groups) destroyers.push(contenders[name](group)); });
      const samples = [];
      for (let i = 0; i < 200; i++) {
        const group = groups[i % instances];
        group.querySelector("button").focus();
        samples.push(timed(() => document.activeElement.dispatchEvent(key())));
      }
      for (const destroy of destroyers) destroy();
      for (const group of groups) group.remove();
      return { init, key: median(samples) };
    },
    shortcuts(name) {
      const combos = Array.from({ length: 20 }, (_, i) => String.fromCharCode(97 + i));
      let hits = 0;
      const hit = () => { hits++; };
      let cleanup;
      if (name === "keystra") {
        const handles = combos.map((letter) => createKeyBinding(`Ctrl+${letter}`, hit));
        cleanup = () => handles.forEach((handle) => handle.destroy());
      } else if (name === "tinykeys") {
        cleanup = tinykeys(window, Object.fromEntries(combos.map((letter) => [`Control+${letter}`, hit])));
      } else {
        for (const letter of combos) hotkeys(`ctrl+${letter}`, hit);
        cleanup = () => { for (const letter of combos) hotkeys.unbind(`ctrl+${letter}`); };
      }
      const started = performance.now();
      for (let i = 0; i < 2000; i++) {
        const letter = combos[i % combos.length];
        const options = {
          key: letter, code: `Key${letter.toUpperCase()}`, keyCode: letter.toUpperCase().charCodeAt(0),
          ctrlKey: true, bubbles: true, cancelable: true,
        };
        document.body.dispatchEvent(new KeyboardEvent("keydown", options));
        document.body.dispatchEvent(new KeyboardEvent("keyup", options));
      }
      const elapsed = performance.now() - started;
      cleanup();
      return { key: (elapsed / 2000) * 1000, hits };
    },
  };
};

const server = createServer((_request, response) => {
  response.setHeader("content-type", "text/html");
  response.end("<!doctype html><body>");
}).listen(0);
const browser = await chromium.launch({ channel: "chrome", headless: true });
console.log(`\nChrome ${browser.version()}, Node ${process.version}. Times are medians in milliseconds.`);
console.log("Heap is what a group retains after a forced garbage collection.\n");

const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.addScriptTag({ content: Buffer.from(script).toString() });
await page.evaluate(inPage);
const cdp = await page.context().newCDPSession(page);
const heap = async () => {
  await cdp.send("HeapProfiler.collectGarbage");
  return (await cdp.send("Runtime.getHeapUsage")).usedSize;
};

const contenders = await page.evaluate(() => bench.contenders);
console.log("items".padEnd(8) + "implementation".padEnd(18) + "init".padStart(10) + "keydown".padStart(10) + "heap kB".padStart(10));
for (const count of [100, 1000, 10000]) {
  for (const name of contenders) {
    const init = [];
    const press = [];
    const retained = [];
    let moved = true;
    for (let run = 0; run < 5; run++) {
      await page.evaluate(([n, c]) => bench.prepare(n, c), [name, count]);
      const before = await heap();
      init.push(await page.evaluate(() => bench.create()));
      const result = await page.evaluate(() => bench.press(50));
      press.push(result.median);
      moved &&= result.moved;
      retained.push((await heap()) - before);
      await page.evaluate(() => bench.clear());
    }
    const mid = (values) => values.sort((a, b) => a - b)[2];
    console.log(
      String(count).padEnd(8) + name.padEnd(18) + mid(init).toFixed(2).padStart(10) +
      (moved ? mid(press).toFixed(3) : "no move").padStart(10) + (mid(retained) / 1024).toFixed(0).padStart(10),
    );
  }
}

console.log("\n500 concurrent instances of 10 items\n");
console.log("implementation".padEnd(18) + "init".padStart(10) + "keydown".padStart(10));
for (const name of contenders) {
  const { init, key } = await page.evaluate((n) => bench.concurrent(n, 500), name);
  console.log(name.padEnd(18) + init.toFixed(2).padStart(10) + key.toFixed(3).padStart(10));
}

console.log("\n20 shortcuts, 2000 presses, microseconds per press\n");
console.log("implementation".padEnd(18) + "press".padStart(10) + "matched".padStart(10));
for (const name of ["keystra", "tinykeys", "hotkeys-js"]) {
  const { key, hits } = await page.evaluate((n) => bench.shortcuts(n), name);
  console.log(name.padEnd(18) + key.toFixed(1).padStart(10) + String(hits).padStart(10));
}

await browser.close();
server.close();

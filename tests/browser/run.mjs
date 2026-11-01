#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist");

const fixture = `<!doctype html><meta charset="utf-8"><title>Keystra</title>
<style>.gone { display: none }</style>
<button id="before">before</button>
<div id="plain"><button data-keystra-item id="p1">P1</button><button data-keystra-item id="p2">P2</button></div>
<div id="links"><a data-keystra-item id="l1" href="#followed">Link</a></div>
<dialog id="dlg"><div id="inner"><button data-keystra-item>D1</button><button data-keystra-item>D2</button></div></dialog>
<button id="trigger">Menu</button>
<div id="menu" hidden><button data-keystra-item id="m1">M1</button><button data-keystra-item id="m2">M2</button></div>
<button id="after">after</button>
<div id="css">
  <button data-keystra-item id="c1">C1</button>
  <button data-keystra-item id="c2" style="display:none">x</button>
  <button data-keystra-item id="c3" class="gone">x</button>
  <span hidden><button data-keystra-item id="c4">x</button></span>
  <button data-keystra-item id="c5" disabled>x</button>
  <button data-keystra-item id="c6">C6</button>
</div>
<div id="tablist" role="tablist">
  <button role="tab" id="t1" aria-controls="tp1">One</button>
  <button role="tab" id="t2" aria-controls="tp2">Two</button>
</div>
<div id="tp1" role="tabpanel">first</div><div id="tp2" role="tabpanel" hidden>second</div>
<div id="group">
  <button data-keystra-item id="g1">G1</button>
  <div id="sub"><button data-keystra-item id="s1">S1</button><button data-keystra-item id="s2">S2</button></div>
  <button data-keystra-item id="g2">G2</button>
</div>
<button id="end">end</button>
<div id="palette" hidden><input id="search"><div id="results"><div class="row">Open</div><div class="row">Save</div></div></div>
<script type="module">
  import * as K from "/index.js";
  window.clicks = [];
  document.addEventListener("click", (event) => clicks.push(event.target.id));
  window.plain = K.createKeystra({ container: "#plain" });
  K.createKeystra({ container: "#links" });
  window.inner = K.createKeystra({ container: "#inner" });
  window.drop = K.createDropdown({ trigger: "#trigger", container: "#menu", onSelect: (item) => clicks.push("select:" + item.id) });
  window.css = K.createKeystra({ container: "#css", loop: true });
  window.tabs = K.createTabs({ container: "#tablist", items: "[role=tab]", panels: "[role=tabpanel]" });
  window.group = K.createKeystra({ container: "#group", mode: "horizontal" });
  window.sub = K.createKeystra({ container: "#sub" });
  window.save = [];
  K.createKeyBinding("Ctrl+B", () => save.push("ctrl+b"));
  window.palette = K.createCommandPalette({
    container: "#palette", input: "#search", list: "#results", items: ".row",
    onSubmit: (item, query) => save.push(item ? item.textContent : "none:" + query),
  });
  window.ready = true;
</script>`;

const server = createServer(async (request, response) => {
  if (request.url === "/" || request.url.startsWith("/#")) {
    response.setHeader("content-type", "text/html");
    response.end(fixture);
    return;
  }
  try {
    const body = await readFile(join(dist, request.url));
    response.setHeader("content-type", "text/javascript");
    response.end(body);
  } catch {
    response.statusCode = 404;
    response.end();
  }
}).listen(0);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForFunction(() => window.ready === true);

let failures = 0;
function check(name, passed, detail = "") {
  if (!passed) failures++;
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${passed || detail === "" ? "" : `  (got ${detail})`}`);
}
const active = () => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
const isActive = async (name, id) => {
  const current = await active();
  check(name, current === id, current);
};
const run = (fn) => page.evaluate(fn);
const press = (key) => page.keyboard.press(key);

await run(() => plain.focusIndex(0));
await press("Enter");
check("Enter clicks a button nothing listens to", (await run(() => clicks.join())) === "p1");
await run(() => { clicks.length = 0; });
await press("Space");
check("Space clicks a button nothing listens to", (await run(() => clicks.join())) === "p1");
await run(() => { document.querySelector("#l1").focus(); });
await press("Enter");
check("Enter follows a link", (await run(() => location.hash)) === "#followed");

await run(() => { dlg.showModal(); inner.focusIndex(0); });
await press("Escape");
check("Escape reaches a surrounding <dialog>", (await run(() => dlg.open)) === false);

await run(() => plain.focusIndex(0));
await press("ArrowDown");
await isActive("Arrow moves focus", "p2");
await press("Tab");
await isActive("Tab leaves a roving group in one stop", "l1");
await press("Shift+Tab");
await isActive("Shift+Tab returns to the remembered item", "p2");

await run(() => document.querySelector("#c1").focus());
await press("ArrowDown");
await isActive("Skips inline, stylesheet, inherited hidden and disabled items", "c6");
await run(() => { document.querySelector("#c3").classList.remove("gone"); });
await press("ArrowUp");
await isActive("Sees an item a stylesheet change revealed, without refresh()", "c3");
await run(() => { document.querySelector("#c3").classList.add("gone"); });

await run(() => { clicks.length = 0; trigger.focus(); });
await press("Enter");
await isActive("Dropdown opens a [hidden] menu onto its first item", "m1");
await press("Tab");
check("Tab closes the dropdown", (await run(() => drop.isOpen)) === false);
await isActive("Tab continues past the trigger", "after");
check("The menu is hidden again", await run(() => document.querySelector("#menu").hidden));
await run(() => trigger.focus());
await press("ArrowUp");
await isActive("ArrowUp opens onto the last item", "m2");
await press("Enter");
await isActive("Enter returns to the trigger", "trigger");
check("onSelect fires once", (await run(() => clicks.join())) === "select:m2");

await run(() => document.querySelector("#t1").focus());
await press("ArrowRight");
await isActive("Arrow moves between tabs", "t2");
check("Automatic activation swaps the panels", await run(() => tp1.hidden && !tp2.hidden));

await run(() => document.querySelector("#g1").focus());
await press("ArrowRight");
await isActive("The outer group steps over the inner group", "g2");
await run(() => document.querySelector("#s1").focus());
await press("ArrowDown");
await isActive("The inner group keeps its own keys", "s2");

await run(() => document.querySelector("#end").focus());
await press("Control+KeyB");
check("A chord fires", (await run(() => save.join())) === "ctrl+b");
await run(() => { save.length = 0; });
await press("Control+Shift+KeyB");
check("A chord with extra Shift does not", (await run(() => save.length)) === 0);

await run(() => palette.open());
await isActive("The palette focuses its search field", "search");
await press("ArrowDown");
await isActive("Arrows leave focus in the field", "search");
await press("Enter");
check("Enter submits the highlighted row", (await run(() => save.join())) === "Save");
await run(() => { save.length = 0; });
await page.keyboard.type("hi");
check("Typing reaches the field", (await run(() => search.value)) === "hi");
await run(() => { results.innerHTML = ""; palette.refresh(); });
await press("Enter");
check("Enter with no results submits the query", (await run(() => save.join())) === "none:hi");
await press("Escape");
check("Escape closes the palette", (await run(() => palette.isOpen)) === false);
await isActive("Escape returns focus", "end");

check("No page errors", errors.length === 0, errors.join(" | "));

await browser.close();
server.close();
console.log(failures === 0 ? "\nAll browser checks passed." : `\n${failures} browser check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

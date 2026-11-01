import { afterEach, describe, expect, it, vi } from "vitest";
import { createKeystra } from "../src/index.js";
import type { KeystraInstance } from "../src/types/index.js";
import { makeList, press, resetDom } from "./helpers.js";

const instances: KeystraInstance<HTMLElement>[] = [];
function create(options: Parameters<typeof createKeystra<HTMLElement>>[0]) {
  const instance = createKeystra(options);
  instances.push(instance);
  return instance;
}

afterEach(() => {
  while (instances.length) instances.pop()?.destroy();
  resetDom();
});

describe("focus tracking", () => {
  it("picks up focus the browser moved on its own", () => {
    const { items } = makeList(4);
    const nav = create({ container: "#group", items: "button" });
    expect(nav.activeIndex).toBe(-1);

    items[2]!.focus();
    expect(nav.activeIndex).toBe(2);

    press("ArrowDown");
    expect(nav.activeIndex).toBe(3);
  });

  it("ignores focus outside the container", () => {
    makeList(3);
    const outside = document.createElement("button");
    outside.id = "outside";
    document.body.appendChild(outside);

    const nav = create({ container: "#group", items: "button" });
    outside.focus();
    expect(nav.activeIndex).toBe(-1);
  });

  it("recognises focus on a descendant of an item", () => {
    const { container } = makeList(3);
    const inner = document.createElement("span");
    inner.textContent = "icon";
    container.querySelectorAll("button")[1]!.appendChild(inner);

    const nav = create({ container: "#group", items: "button" });
    inner.focus();
    expect(nav.activeIndex).toBe(1);
  });

  it("restores focus to whatever was focused before the group took over", () => {
    const trigger = document.createElement("button");
    trigger.id = "trigger";
    document.body.appendChild(trigger);
    makeList(3);

    const nav = create({ container: "#group", items: "button" });
    trigger.focus();
    nav.focusIndex(1);
    expect(document.activeElement?.textContent).toBe("item-1");

    expect(nav.restoreFocus()).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it("falls back to the last focused item when there is nothing to restore", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(2);
    items[2]!.blur();
    document.body.focus();
    expect(nav.restoreFocus()).toBe(true);
    expect(document.activeElement).toBe(items[2]);
  });

  it("keeps the restore target across several focus moves", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    makeList(3);
    const nav = create({ container: "#group", items: "button" });
    trigger.focus();
    nav.focusIndex(0);
    nav.focusIndex(1);
    nav.focusIndex(2);
    nav.restoreFocus();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("nested groups", () => {
  const directButtons = (container: Element) =>
    Array.from(container.children).filter((child) => child.tagName === "BUTTON") as HTMLElement[];

  function buildNested() {
    document.body.innerHTML = `
      <div id="outer">
        <button id="o1">outer 1</button>
        <div id="inner">
          <button id="i1">inner 1</button>
          <button id="i2">inner 2</button>
          <button id="i3">inner 3</button>
        </div>
        <button id="o2">outer 2</button>
      </div>`;
    return {
      outer: document.getElementById("outer")!,
      inner: document.getElementById("inner")!,
      o1: document.getElementById("o1") as HTMLElement,
      o2: document.getElementById("o2") as HTMLElement,
      i1: document.getElementById("i1") as HTMLElement,
      i2: document.getElementById("i2") as HTMLElement,
      i3: document.getElementById("i3") as HTMLElement,
    };
  }

  it("the innermost group handles the key and the outer one stays put", () => {
    const dom = buildNested();
    const outer = create({ container: dom.outer, items: directButtons });
    const inner = create({ container: dom.inner, items: "button" });

    outer.focusElement(dom.o1);
    expect(outer.activeElement).toBe(dom.o1);

    inner.focusElement(dom.i1);
    press("ArrowDown");
    expect(inner.activeIndex).toBe(1);
    expect(outer.activeElement).toBe(dom.o1);
    expect(document.activeElement).toBe(dom.i2);
  });

  it("an outer group can be paused while a nested one is open", () => {
    const dom = buildNested();
    let innerOpen = false;
    const outer = create({ container: dom.outer, items: directButtons, when: () => !innerOpen });
    const inner = create({ container: dom.inner, items: "button", enabled: false });

    outer.focusElement(dom.o1);
    innerOpen = true;
    inner.enable();
    inner.focusElement(dom.i1);

    press("ArrowDown");
    expect(inner.activeIndex).toBe(1);
    expect(outer.activeElement).toBe(dom.o1);
  });

  it("a parent group can exclude nested items with a selector", () => {
    const dom = buildNested();
    const outer = create({ container: dom.outer, items: directButtons });
    expect(outer.items.map((element) => element.id)).toEqual(["o1", "o2"]);
  });

  it("Escape in a nested group can be stopped from reaching the parent", () => {
    const dom = buildNested();
    const onOuterEscape = vi.fn();
    const onInnerEscape = vi.fn();
    create({ container: dom.outer, items: directButtons, onEscape: onOuterEscape });
    const inner = create({ container: dom.inner, items: "button", onEscape: onInnerEscape });

    inner.focusElement(dom.i1);
    press("Escape");
    expect(onInnerEscape).toHaveBeenCalledTimes(1);
    expect(onOuterEscape).not.toHaveBeenCalled();
  });
});

describe("independent instances", () => {
  it("two groups on one page do not interfere", () => {
    document.body.innerHTML = `
      <div id="a"><button>a0</button><button>a1</button><button>a2</button></div>
      <div id="b"><button>b0</button><button>b1</button><button>b2</button></div>`;

    const a = create({ container: "#a", items: "button" });
    const b = create({ container: "#b", items: "button", loop: true });

    a.focusIndex(0);
    b.focusIndex(0);
    expect(document.activeElement).toBe(b.items[0]);

    press("ArrowDown", { target: a.items[0]! });
    expect(a.activeIndex).toBe(1);
    expect(document.activeElement).toBe(a.items[1]);
    expect(b.currentIndex).toBe(0);

    press("ArrowUp", { target: a.items[1]! });
    expect(a.currentIndex).toBe(0);
    press("ArrowUp", { target: a.items[0]! });
    expect(a.currentIndex).toBe(0);

    press("ArrowUp", { target: b.items[0]! });
    expect(b.currentIndex).toBe(2);
    expect(b.activeElement).toBe(b.items[2]);
    expect(a.currentIndex).toBe(0);
  });

  it("fifty instances cost nothing while idle", () => {
    const many: KeystraInstance<HTMLElement>[] = [];
    for (let i = 0; i < 50; i++) {
      const { container } = makeList(3, { containerId: `g${i}` });
      many.push(createKeystra({ container, items: "button" }));
      instances.push(many[many.length - 1]!);
    }
    expect(many).toHaveLength(50);
    many[49]!.focusIndex(0);
    press("ArrowDown");
    expect(many[49]!.activeIndex).toBe(1);
    expect(many[0]!.activeIndex).toBe(-1);
  });
});

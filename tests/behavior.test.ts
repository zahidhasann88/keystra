import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCommandPalette,
  createDropdown,
  createKeyBinding,
  createKeystra,
  createList,
  createTabs,
} from "../src/index.js";
import { makeList, press, pressed, resetDom } from "./helpers.js";

const destroyers: (() => void)[] = [];
function track<T extends { destroy(): void }>(instance: T): T {
  destroyers.push(() => instance.destroy());
  return instance;
}

beforeEach(resetDom);
afterEach(() => {
  while (destroyers.length > 0) destroyers.pop()!();
  resetDom();
});

describe("keyboard events", () => {
  it("runs a full configuration end to end", () => {
    const { items } = makeList(3, { containerId: "navigation" });
    const onFocus = vi.fn();
    const onSelect = vi.fn();
    const navigation = createKeystra({
      container: "#navigation",
      mode: "vertical",
      loop: true,
      keys: { next: "ArrowDown", previous: "ArrowUp", first: "Home", last: "End", select: "Enter", escape: "Escape" },
      onFocus(element) {
        onFocus(element);
      },
      onSelect(element) {
        onSelect(element);
      },
    });
    navigation.focusFirst();
    navigation.next();
    expect(onFocus).toHaveBeenLastCalledWith(items[1]);
    navigation.previous();
    navigation.focusLast();
    press("Enter");
    expect(onSelect).toHaveBeenCalledWith(items[2]);
    navigation.destroy();
  });

  it.each([
    ["ArrowDown", "vertical", 0, 1],
    ["ArrowUp", "vertical", 1, 0],
    ["ArrowRight", "horizontal", 0, 1],
    ["ArrowLeft", "horizontal", 1, 0],
    ["Home", "vertical", 2, 0],
    ["End", "vertical", 0, 2],
    ["PageDown", "vertical", 0, 2],
    ["PageUp", "vertical", 2, 0],
  ] as const)("%s in %s mode moves from %i to %i", (key, mode, from, to) => {
    const { items } = makeList(3);
    const nav = track(createKeystra({ container: "#group", items: "button", mode, pageSize: 2 }));
    nav.focusIndex(from);
    expect(pressed(key)).toBe(false);
    expect(document.activeElement).toBe(items[to]);
  });

  it("binds Tab and Shift+Tab only when asked to", () => {
    const { items } = makeList(3);
    const nav = track(createKeystra({ container: "#group", items: "button" }));
    nav.focusIndex(0);
    expect(pressed("Tab")).toBe(true);
    expect(pressed("Tab", { shiftKey: true })).toBe(true);
    nav.update({ keys: { next: "Tab", previous: "Shift+Tab" } });
    expect(pressed("Tab")).toBe(false);
    expect(document.activeElement).toBe(items[1]);
    expect(pressed("Tab", { shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(items[0]);
  });

  it("does not claim a browser chord that merely contains its own", () => {
    const save = vi.fn();
    track(createKeyBinding("Ctrl+S", save));
    expect(pressed("S", { ctrlKey: true, shiftKey: true, target: document.body })).toBe(true);
    expect(save).not.toHaveBeenCalled();
    expect(pressed("s", { ctrlKey: true, target: document.body })).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe("lifecycle", () => {
  it("removes every listener it added", () => {
    const trigger = document.createElement("button");
    trigger.id = "trigger";
    document.body.appendChild(trigger);
    makeList(3, { containerId: "menu" });

    const live = new Map<string, number>();
    const note = (type: string, delta: number) => live.set(type, (live.get(type) ?? 0) + delta);
    for (const target of [document, trigger, document.getElementById("menu")!]) {
      const add = target.addEventListener.bind(target);
      const remove = target.removeEventListener.bind(target);
      vi.spyOn(target as EventTarget, "addEventListener").mockImplementation((type, listener, options) => {
        note(type, 1);
        add(type, listener!, options);
      });
      vi.spyOn(target as EventTarget, "removeEventListener").mockImplementation((type, listener, options) => {
        note(type, -1);
        remove(type, listener!, options);
      });
    }

    const dropdown = createDropdown({ trigger, container: "#menu", closeOnBlur: true, pointerSync: true, observe: true });
    dropdown.open();
    dropdown.destroy();
    vi.restoreAllMocks();
    expect(live.size).toBeGreaterThan(0);
    expect([...live.values()].every((count) => count === 0)).toBe(true);
  });

  it("keeps instances on one page independent", () => {
    const first = makeList(3, { containerId: "first" });
    const second = makeList(3, { containerId: "second" });
    const a = track(createKeystra({ container: "#first", items: "button" }));
    const b = track(createKeystra({ container: "#second", items: "button" }));
    a.focusIndex(0);
    press("ArrowDown");
    expect(document.activeElement).toBe(first.items[1]);
    expect(b.currentIndex).toBe(-1);
    expect(second.items[0]!.getAttribute("tabindex")).toBe("0");
  });

  it("does not pin items that were rendered away", () => {
    const { container, items } = makeList(4);
    const nav = createKeystra({ container: "#group", items: "button" }) as unknown as {
      focus: { roving: { touched: number } };
      refresh(): readonly Element[];
      destroy(): void;
    };
    nav.refresh();
    expect(nav.focus.roving.touched).toBe(4);
    for (const item of items.slice(1)) container.removeChild(item);
    nav.refresh();
    expect(nav.focus.roving.touched).toBe(1);
    nav.destroy();
  });
});

describe("nested groups", () => {
  function makeNested(): { before: HTMLElement; after: HTMLElement; innerItem: HTMLElement } {
    document.body.innerHTML = `
      <div id="outer">
        <button data-keystra-item id="before">before</button>
        <div id="inner">
          <button data-keystra-item id="inner-1">one</button>
          <button data-keystra-item id="inner-2">two</button>
        </div>
        <button data-keystra-item id="after">after</button>
      </div>`;
    const get = (id: string) => document.getElementById(id)!;
    return { before: get("before"), after: get("after"), innerItem: get("inner-1") };
  }

  it("leaves the items of an inner group to that group", () => {
    const { before, after, innerItem } = makeNested();
    const outer = track(createKeystra({ container: "#outer" }));
    const inner = track(createKeystra({ container: "#inner" }));
    expect(outer.items).toEqual([before, after]);
    expect(inner.items[0]).toBe(innerItem);
  });

  it("gives the items back when the inner group is destroyed", () => {
    makeNested();
    const outer = track(createKeystra({ container: "#outer" }));
    const inner = createKeystra({ container: "#inner" });
    expect(outer.refresh()).toHaveLength(2);
    inner.destroy();
    expect(outer.refresh()).toHaveLength(4);
  });
});

describe("accessibility defaults", () => {
  function makeNav(): HTMLElement {
    document.body.innerHTML = `<nav id="site"><button>One</button><button>Two</button></nav>`;
    return document.getElementById("site")!;
  }

  it("does not erase a landmark with a widget role", () => {
    const nav = makeNav();
    track(createList({ container: "#site", items: "button" }));
    track(createTabs({ container: "#site", items: "button" }));
    expect(nav.hasAttribute("role")).toBe(false);
    expect(nav.hasAttribute("aria-orientation")).toBe(false);
  });

  it("exposes listbox selection through aria-selected", () => {
    const { container, items } = makeList(3);
    const list = track(createList({ container: "#group", items: "button", selection: { mode: "multiple" } }));
    expect(container.getAttribute("aria-multiselectable")).toBe("true");
    list.selection!.select(1);
    list.refresh();
    expect(items[1]!.getAttribute("aria-selected")).toBe("true");
    expect(items[0]!.getAttribute("aria-selected")).toBe("false");
  });

  it("leaves aria-selected out of a list the author gave another role", () => {
    const { container, items } = makeList(2);
    container.setAttribute("role", "toolbar");
    const list = track(createList({ container: "#group", items: "button" }));
    list.focusIndex(1);
    expect(items[1]!.hasAttribute("aria-selected")).toBe(false);
  });

  it("marks the active palette option as selected", () => {
    document.body.innerHTML = `<input id="q" /><div id="palette" hidden><div class="row">A</div><div class="row">B</div></div>`;
    const input = document.getElementById("q") as HTMLInputElement;
    const palette = track(createCommandPalette({ container: "#palette", input, items: ".row" }));
    palette.open();
    const [first, second] = palette.items;
    expect(first!.getAttribute("aria-selected")).toBe("true");
    press("ArrowDown", { target: input });
    expect(first!.getAttribute("aria-selected")).toBe("false");
    expect(second!.getAttribute("aria-selected")).toBe("true");
  });
});

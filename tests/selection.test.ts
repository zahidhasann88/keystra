import { afterEach, describe, expect, it, vi } from "vitest";
import { createKeystra, SelectionManager } from "../src/index.js";
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

describe("single selection", () => {
  it("selects on Enter and replaces the previous choice", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", selection: true });
    nav.focusIndex(0);
    press("Enter");
    expect(nav.selection?.selected).toEqual([items[0]]);

    nav.focusIndex(2);
    press("Enter");
    expect(nav.selection?.selected).toEqual([items[2]]);
    expect(nav.selection?.isSelected(items[0])).toBe(false);
  });

  it("does not toggle with Space in single mode", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", selection: { mode: "single" } });
    nav.focusIndex(1);
    press("Enter");
    press(" ");
    expect(nav.selection?.selected).toEqual([items[1]]);
  });

  it("reports selected indexes in list order", () => {
    const { items } = makeList(4);
    const nav = create({ container: "#group", items: "button", selection: true });
    nav.selection?.select(items[3]);
    expect(nav.selection?.selectedIndexes).toEqual([3]);
    nav.selection?.select(1);
    expect(nav.selection?.selectedIndexes).toEqual([1]);
  });

  it("can follow focus", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", selection: { mode: "single", followFocus: true } });
    nav.focusIndex(0);
    expect(nav.selection?.selected).toEqual([items[0]]);
    press("ArrowDown");
    expect(nav.selection?.selected).toEqual([items[1]]);
  });
});

describe("multiple selection", () => {
  it("toggles with Space and keeps a set", () => {
    const { items } = makeList(4);
    const nav = create({ container: "#group", items: "button", selection: { mode: "multiple" } });
    nav.focusIndex(0);
    press(" ");
    expect(nav.selection?.selected).toEqual([items[0]]);
    press("ArrowDown");
    press(" ");
    expect(nav.selection?.selected).toEqual([items[0], items[1]]);
    nav.focusIndex(0);
    press(" ");
    expect(nav.selection?.selected).toEqual([items[1]]);
  });

  it("selects everything with Ctrl+A and Meta+A", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", selection: { mode: "multiple" } });
    nav.focusIndex(0);
    press("a", { ctrlKey: true });
    expect(nav.selection?.selected).toEqual(items);
    nav.selection?.clear();
    expect(nav.selection?.selected).toEqual([]);
    press("a", { metaKey: true });
    expect(nav.selection?.selected).toHaveLength(3);
  });

  it("exposes the full selection API", () => {
    const { items } = makeList(4);
    const nav = create({ container: "#group", items: "button", selection: { mode: "multiple" } });
    const selection = nav.selection!;

    selection.select(items[0]);
    selection.select(items[2]);
    expect(selection.selected).toEqual([items[0], items[2]]);

    selection.toggle(1);
    expect(selection.isSelected(1)).toBe(true);
    selection.toggle(items[1]);
    expect(selection.isSelected(items[1])).toBe(false);

    selection.deselect(items[0]);
    expect(selection.selected).toEqual([items[2]]);

    selection.clear();
    expect(selection.selected).toEqual([]);
    expect(selection.selectedIndexes).toEqual([]);
    expect(selection.anchor).toBeNull();
  });

  it("accepts an initial selection", () => {
    const { items } = makeList(4);
    const nav = create({
      container: "#group",
      items: "button",
      selection: { mode: "multiple", initial: [items[1]!, items[2]!] },
    });
    expect(nav.selection?.selected).toEqual([items[1], items[2]]);
  });
});

describe("range selection", () => {
  it("extends with Shift+Arrow from the anchor", () => {
    const { items } = makeList(5);
    const nav = create({ container: "#group", items: "button", selection: { mode: "range" } });
    nav.focusIndex(1);
    press("Enter");
    expect(nav.selection?.anchor).toBe(items[1]);

    press("ArrowDown", { shiftKey: true });
    expect(nav.selection?.selected).toEqual([items[1], items[2]]);
    press("ArrowDown", { shiftKey: true });
    expect(nav.selection?.selected).toEqual([items[1], items[2], items[3]]);
    press("ArrowUp", { shiftKey: true });
    press("ArrowUp", { shiftKey: true });
    expect(nav.selection?.selected).toEqual([items[1]]);
  });

  it("normalises a backwards range", () => {
    const { items } = makeList(5);
    const nav = create({ container: "#group", items: "button", selection: { mode: "range" } });
    nav.selection?.selectRange(items[3], items[1]);
    expect(nav.selection?.selected).toEqual([items[1], items[2], items[3]]);
  });

  it("selects a single item without an anchor", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", selection: { mode: "range" } });
    nav.focusIndex(0);
    press("Enter");
    expect(nav.selection?.selected).toEqual([items[0]]);
    expect(nav.selection?.anchor).toBe(items[0]);
  });

  it("can be told not to extend on Shift", () => {
    const { items } = makeList(4);
    const nav = create({
      container: "#group",
      items: "button",
      selection: { mode: "range", shiftExtendsRange: false },
    });
    nav.focusIndex(0);
    press("Enter");
    press("ArrowDown", { shiftKey: true });
    expect(nav.selection?.selected).toEqual([items[0]]);
  });
});

describe("selection presentation", () => {
  it("stays out of the DOM unless asked", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", selection: true });
    nav.focusIndex(0);
    press("Enter");
    for (const element of items) {
      expect(element.getAttribute("aria-selected")).toBeNull();
      expect(element.className).toBe("");
    }
  });

  it("mirrors state into aria-selected when asked", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", selection: { mode: "multiple", aria: true } });
    nav.selection?.select(items[1]);
    expect(items[1]!.getAttribute("aria-selected")).toBe("true");
    expect(items[0]!.getAttribute("aria-selected")).toBe("false");
    nav.selection?.deselect(items[1]);
    expect(items[1]!.getAttribute("aria-selected")).toBe("false");
  });

  it("mirrors state into a custom attribute and class", () => {
    const { items } = makeList(3);
    const nav = create({
      container: "#group",
      items: "button",
      selection: { mode: "single", attribute: "data-selected", selectedClass: "is-selected" },
    });
    nav.selection?.select(items[2]);
    expect(items[2]!.getAttribute("data-selected")).toBe("true");
    expect(items[2]!.classList.contains("is-selected")).toBe(true);

    nav.selection?.select(items[0]);
    expect(items[2]!.hasAttribute("data-selected")).toBe(false);
    expect(items[2]!.classList.contains("is-selected")).toBe(false);
    expect(items[0]!.getAttribute("data-selected")).toBe("true");
  });

  it("removes presentation on destroy", () => {
    const { items } = makeList(3);
    const nav = createKeystra({
      container: "#group",
      items: "button",
      selection: { mode: "single", attribute: "data-selected", selectedClass: "is-selected", aria: true },
    });
    nav.selection?.select(items[1]);
    nav.destroy();
    expect(items[1]!.hasAttribute("data-selected")).toBe(false);
    expect(items[1]!.hasAttribute("aria-selected")).toBe(false);
    expect(items[1]!.classList.contains("is-selected")).toBe(false);
  });
});

describe("selection events", () => {
  it("calls onChange and emits selectionchange with a diff", () => {
    const { items } = makeList(3);
    const onChange = vi.fn();
    const nav = create({ container: "#group", items: "button", selection: { mode: "multiple", onChange } });
    const events: { added: number; removed: number }[] = [];
    nav.on("selectionchange", ({ added, removed }) => events.push({ added: added.length, removed: removed.length }));

    nav.selection?.select(items[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(events).toEqual([{ added: 1, removed: 0 }]);

    nav.selection?.select(items[1]);
    expect(events).toEqual([
      { added: 1, removed: 0 },
      { added: 1, removed: 0 },
    ]);

    nav.selection?.clear();
    expect(events.at(-1)).toEqual({ added: 0, removed: 2 });
  });

  it("does not emit when nothing changed", () => {
    const { items } = makeList(2);
    const nav = create({ container: "#group", items: "button", selection: { mode: "multiple" } });
    const onChange = vi.fn();
    nav.selection?.setMode("multiple");
    nav.on("selectionchange", onChange);
    nav.selection?.select(items[0]);
    nav.selection?.select(items[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("mode switching", () => {
  it("narrows a multiple selection down to one when switched to single", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", selection: { mode: "multiple" } });
    nav.selection?.select(items[0]);
    nav.selection?.select(items[1]);
    expect(nav.selection?.selected).toHaveLength(2);
    nav.selection?.setMode("single");
    expect(nav.selection?.selected).toEqual([items[0]]);
    expect(nav.selection?.mode).toBe("single");
  });

  it("clears everything when switched to none", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", selection: { mode: "multiple" } });
    nav.selection?.select(items[0]);
    nav.selection?.setMode("none");
    expect(nav.selection?.selected).toEqual([]);
    nav.selection?.select(items[1]);
    expect(nav.selection?.selected).toEqual([]);
  });
});

describe("pointer synchronisation", () => {
  it("focuses and selects on click when enabled", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", selection: true, pointerSync: true });
    items[2]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(nav.currentIndex).toBe(2);
    expect(nav.selection?.selected).toEqual([items[2]]);
  });

  it("toggles with Ctrl+click in multiple mode", () => {
    const { items } = makeList(3);
    const nav = create({
      container: "#group",
      items: "button",
      selection: { mode: "multiple" },
      pointerSync: true,
    });
    items[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    items[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    expect(nav.selection?.selected).toEqual([items[0], items[1]]);
    items[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true, metaKey: true }));
    expect(nav.selection?.selected).toEqual([items[1]]);
  });

  it("extends a range with Shift+click", () => {
    const { items } = makeList(4);
    const nav = create({
      container: "#group",
      items: "button",
      selection: { mode: "range" },
      pointerSync: true,
    });
    items[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    items[2]!.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
    expect(nav.selection?.selected).toEqual([items[0], items[1], items[2]]);
  });

  it("resolves the item from a click on a descendant", () => {
    const { container, items } = makeList(2);
    const inner = document.createElement("span");
    inner.textContent = "icon";
    items[1]!.appendChild(inner);
    const nav = create({ container, items: "button", selection: true, pointerSync: true });
    inner.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(nav.selection?.selected).toEqual([items[1]]);
  });

  it("moves the roving tab stop on hover without stealing focus", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", pointerSync: true });
    nav.focusIndex(0);
    items[2]!.dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(items[2]!.getAttribute("tabindex")).toBe("0");
    expect(document.activeElement).toBe(items[0]);
  });

  it("does nothing when pointerSync is off", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", selection: true });
    items[2]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(nav.selection?.selected).toEqual([]);
  });
});

describe("SelectionManager used standalone", () => {
  it("works without an engine", () => {
    const { items } = makeList(4);
    const manager = new SelectionManager<HTMLElement>({ mode: "multiple" });
    manager.sync(items);
    manager.select(0);
    manager.toggle(items[2]);
    expect(manager.selected).toEqual([items[0], items[2]]);
    manager.selectAll();
    expect(manager.selected).toEqual(items);
    manager.clear();
    expect(manager.selected).toEqual([]);
    manager.dispose();
  });

  it("prunes selections whose element left the list", () => {
    const { items } = makeList(3);
    const manager = new SelectionManager<HTMLElement>({ mode: "multiple" });
    manager.sync(items);
    manager.select(items[1]);
    manager.select(items[2]);
    manager.sync([items[0]!, items[2]!]);
    expect(manager.selected).toEqual([items[2]]);
  });

  it("applies an initial selection by index, element or array", () => {
    const { items } = makeList(3);
    const byIndex = new SelectionManager<HTMLElement>({ mode: "single", initial: 1 });
    byIndex.sync(items);
    byIndex.applyInitial(1);
    expect(byIndex.selected).toEqual([items[1]]);

    const byElement = new SelectionManager<HTMLElement>({ mode: "single" });
    byElement.sync(items);
    byElement.applyInitial(items[2]);
    expect(byElement.selected).toEqual([items[2]]);
  });
});

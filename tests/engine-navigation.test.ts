import { afterEach, describe, expect, it, vi } from "vitest";
import { createKeystra } from "../src/index.js";
import type { KeystraInstance, KeystraOptions } from "../src/types/index.js";
import { makeList, press, pressed, resetDom, stubGridLayout } from "./helpers.js";

const instances: KeystraInstance<HTMLElement>[] = [];

function create<T extends HTMLElement = HTMLElement>(options: KeystraOptions<T>): KeystraInstance<T> {
  const instance = createKeystra<T>(options);
  instances.push(instance as unknown as KeystraInstance<HTMLElement>);
  return instance;
}

afterEach(() => {
  while (instances.length) instances.pop()?.destroy();
  resetDom();
});

function rect(left: number, top: number, size = 20): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width: size,
    height: size,
    right: left + size,
    bottom: top + size,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("vertical navigation", () => {
  it("moves down and up with the arrow keys", () => {
    const { items } = makeList(5);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(0);

    press("ArrowDown");
    expect(nav.activeIndex).toBe(1);
    press("ArrowDown");
    expect(nav.activeIndex).toBe(2);
    press("ArrowUp");
    expect(nav.activeIndex).toBe(1);
    expect(document.activeElement).toBe(items[1]);
  });

  it("does not wrap by default", () => {
    makeList(5);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(4);
    press("ArrowDown");
    expect(nav.activeIndex).toBe(4);
    nav.focusIndex(0);
    press("ArrowUp");
    expect(nav.activeIndex).toBe(0);
  });

  it("wraps when loop is enabled", () => {
    makeList(5);
    const nav = create({ container: "#group", items: "button", loop: true });
    nav.focusIndex(4);
    press("ArrowDown");
    expect(nav.activeIndex).toBe(0);
    nav.focusIndex(0);
    press("ArrowUp");
    expect(nav.activeIndex).toBe(4);
  });

  it("ignores keys that belong to the other axis", () => {
    makeList(5);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(0);
    press("ArrowLeft");
    expect(nav.activeIndex).toBe(0);
    press("ArrowRight");
    expect(nav.activeIndex).toBe(0);
  });

  it("jumps to the ends with Home and End", () => {
    makeList(5);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(2);
    press("End");
    expect(nav.activeIndex).toBe(4);
    press("Home");
    expect(nav.activeIndex).toBe(0);
  });

  it("pages by the configured page size and clamps at the end", () => {
    makeList(25);
    const nav = create({ container: "#group", items: "button", pageSize: 10 });
    nav.focusIndex(0);
    press("PageDown");
    expect(nav.activeIndex).toBe(10);
    press("PageDown");
    expect(nav.activeIndex).toBe(20);
    press("PageDown");
    expect(nav.activeIndex).toBe(24);
    press("PageUp");
    expect(nav.activeIndex).toBe(14);
  });

  it("ignores keys until focus is inside the group", () => {
    makeList(5);
    const nav = create({ container: "#group", items: "button" });
    document.body.focus();
    press("ArrowDown");
    expect(nav.activeIndex).toBe(-1);

    nav.focusFirst();
    press("ArrowDown");
    expect(nav.activeIndex).toBe(1);
  });

  it("can be told to listen regardless of focus", () => {
    const { container, items } = makeList(5);
    const nav = create({ container: "#group", items: "button", onlyWhenFocusedInside: false });
    nav.focusIndex(2);
    const outside = document.createElement("button");
    outside.id = "outside";
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);
    press("ArrowDown", { target: container });
    expect(nav.activeIndex).toBe(3);
    expect(nav.activeElement).toBe(items[3]);
  });

  it("exposes programmatic navigation that mirrors the keys", () => {
    const { items } = makeList(5);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(0);

    expect(nav.next()?.textContent).toBe("item-1");
    expect(nav.next(2)?.textContent).toBe("item-3");
    expect(nav.previous()?.textContent).toBe("item-2");
    expect(nav.first()?.textContent).toBe("item-0");
    expect(nav.last()?.textContent).toBe("item-4");
    expect(nav.focusFirst()?.textContent).toBe("item-0");
    expect(nav.focusLast()?.textContent).toBe("item-4");
    expect(nav.focusIndex(3)?.textContent).toBe("item-3");
    expect(nav.focusElement(items[1])).toBe(true);
    expect(nav.activeElement).toBe(items[1]);
    expect(nav.down()?.textContent).toBe("item-2");
    expect(nav.up()?.textContent).toBe("item-1");
    expect(nav.move("down")?.textContent).toBe("item-2");
  });

  it("returns null for out-of-range programmatic moves", () => {
    makeList(3);
    const nav = create({ container: "#group", items: "button" });
    expect(nav.focusIndex(99)).toBeNull();
    expect(nav.focusIndex(-3)).toBeNull();
    expect(nav.focusElement(null)).toBe(false);
  });

  it("enters the group at the nearer end when nothing is focused yet", () => {
    const { items } = makeList(4);
    const nav = create({ container: "#group", items: "button" });
    expect(nav.activeIndex).toBe(-1);
    expect(nav.next()).toBe(items[0]);
    expect(nav.activeIndex).toBe(0);
    nav.setActiveIndex(-1, { focus: false });
    expect(nav.previous()).toBe(items[3]);
  });

  it("emits focus and action events", () => {
    const { items } = makeList(5);
    const onFocus = vi.fn();
    const onAction = vi.fn();
    const nav = create({ container: "#group", items: "button", onFocus, onAction });
    nav.focusIndex(0);
    press("ArrowDown");

    expect(onFocus).toHaveBeenCalledTimes(2);
    expect(onFocus).toHaveBeenLastCalledWith(items[1], 1);
    expect(onAction.mock.calls.at(-1)?.[0]).toBe("down");
  });

  it("emits blur when focus leaves an item", () => {
    const { items } = makeList(3);
    const onBlur = vi.fn();
    const nav = create({ container: "#group", items: "button", onBlur });
    nav.focusIndex(0);
    nav.focusIndex(1);
    expect(onBlur).toHaveBeenCalledWith(items[0], 0);
  });

  it("reports handled and unhandled presses through the keydown event", () => {
    makeList(3);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(0);
    const seen: boolean[] = [];
    nav.on("keydown", ({ handled }) => seen.push(handled));
    press("ArrowDown");
    press("F13");
    expect(seen).toEqual([true, false]);
  });

  it("does nothing at all when there are no items", () => {
    makeList(3);
    const nav = create({ container: "#group", items: ".nothing-here" });
    expect(nav.items).toHaveLength(0);
    expect(nav.next()).toBeNull();
    expect(nav.first()).toBeNull();
    expect(pressed("ArrowDown")).toBe(true);
  });

  it("can unsubscribe a single listener", () => {
    makeList(3);
    const nav = create({ container: "#group", items: "button" });
    const handler = vi.fn();
    const off = nav.on("focus", handler);
    nav.focusIndex(0);
    expect(handler).toHaveBeenCalledTimes(1);
    off();
    nav.focusIndex(1);
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });
});

describe("horizontal navigation", () => {
  it("uses left and right arrows and ignores up and down", () => {
    const { items } = makeList(4);
    const nav = create({ container: "#group", items: "button", mode: "horizontal" });
    nav.focusIndex(0);

    press("ArrowRight");
    expect(nav.activeIndex).toBe(1);
    press("ArrowDown");
    expect(nav.activeIndex).toBe(1);
    press("ArrowLeft");
    expect(nav.activeIndex).toBe(0);
    press("ArrowLeft");
    expect(nav.activeIndex).toBe(0);
    expect(document.activeElement).toBe(items[0]);
  });

  it("wraps in both directions when loop is on", () => {
    makeList(4);
    const nav = create({ container: "#group", items: "button", mode: "horizontal", loop: true });
    nav.focusIndex(3);
    press("ArrowRight");
    expect(nav.activeIndex).toBe(0);
    press("ArrowLeft");
    expect(nav.activeIndex).toBe(3);
  });
});

describe("grid navigation", () => {
  it("moves in two dimensions with an explicit column count", () => {
    const { items } = makeList(9);
    stubGridLayout(items, 3);
    const grid = create({ container: "#group", items: "button", mode: "grid", columns: 3 });
    grid.focusIndex(0);

    press("ArrowRight");
    expect(grid.activeIndex).toBe(1);
    press("ArrowDown");
    expect(grid.activeIndex).toBe(4);
    press("ArrowLeft");
    expect(grid.activeIndex).toBe(3);
    press("ArrowUp");
    expect(grid.activeIndex).toBe(0);
  });

  it("keeps the column when changing rows", () => {
    const { items } = makeList(9);
    stubGridLayout(items, 3);
    const grid = create({ container: "#group", items: "button", mode: "grid", columns: 3 });
    grid.focusIndex(2);

    press("ArrowDown");
    expect(grid.activeIndex).toBe(5);
    press("ArrowDown");
    expect(grid.activeIndex).toBe(8);
    press("ArrowDown");
    expect(grid.activeIndex).toBe(8);
    press("ArrowUp");
    expect(grid.activeIndex).toBe(5);
  });

  it("infers the column count from geometry", () => {
    const { items } = makeList(8);
    stubGridLayout(items, 4);
    const grid = create({ container: "#group", items: "button", mode: "grid" });
    grid.focusIndex(0);

    press("ArrowRight");
    press("ArrowRight");
    expect(grid.activeIndex).toBe(2);
    press("ArrowDown");
    expect(grid.activeIndex).toBe(6);
  });

  it("handles a short last row without landing on a nonexistent cell", () => {
    const { items } = makeList(7);
    stubGridLayout(items, 3);
    const grid = create({ container: "#group", items: "button", mode: "grid" });
    grid.focusIndex(1);

    press("ArrowDown");
    expect(grid.activeIndex).toBe(4);
    press("ArrowDown");
    expect(grid.activeIndex).toBe(6);
  });

  it("wraps within a row and across rows when loop is on", () => {
    const { items } = makeList(6);
    stubGridLayout(items, 3);
    const grid = create({ container: "#group", items: "button", mode: "grid", columns: 3, loop: true });
    grid.focusIndex(2);
    press("ArrowRight");
    expect(grid.activeIndex).toBe(0);
    grid.focusIndex(5);
    press("ArrowDown");
    expect(grid.activeIndex).toBe(2);
  });

  it("moves Home/End across the whole grid by default", () => {
    const { items } = makeList(9);
    stubGridLayout(items, 3);
    const grid = create({ container: "#group", items: "button", mode: "grid", columns: 3 });
    grid.focusIndex(4);
    press("Home");
    expect(grid.activeIndex).toBe(0);
    press("End");
    expect(grid.activeIndex).toBe(8);
  });

  it("does not read layout at all when the column count is given", () => {
    const { items } = makeList(6);
    let reads = 0;
    for (const element of items) {
      element.getBoundingClientRect = () => {
        reads += 1;
        return rect(0, 0, 0);
      };
    }
    const grid = create({ container: "#group", items: "button", mode: "grid", columns: 3 });
    grid.focusIndex(0);
    for (let i = 0; i < 20; i++) press("ArrowDown");
    for (let i = 0; i < 20; i++) press("ArrowRight");
    expect(reads).toBe(0);
  });
});

describe("directional navigation", () => {
  it("finds the spatial neighbour in an irregular layout", () => {
    const { items } = makeList(4);
    items[0]!.getBoundingClientRect = () => rect(0, 0);
    items[1]!.getBoundingClientRect = () => rect(0, 30);
    items[2]!.getBoundingClientRect = () => rect(200, 0);
    items[3]!.getBoundingClientRect = () => rect(60, 0);

    const nav = create({ container: "#group", items: "button", mode: "directional" });
    nav.focusIndex(0);

    press("ArrowRight");
    expect(nav.activeIndex).toBe(3);
    press("ArrowRight");
    expect(nav.activeIndex).toBe(2);
    press("ArrowLeft");
    expect(nav.activeIndex).toBe(3);
    press("ArrowLeft");
    expect(nav.activeIndex).toBe(0);
    press("ArrowDown");
    expect(nav.activeIndex).toBe(1);
  });

  it("reads each rectangle once per refresh", () => {
    const { items } = makeList(6);
    stubGridLayout(items, 3);
    let reads = 0;
    for (const element of items) {
      const original = element.getBoundingClientRect.bind(element);
      element.getBoundingClientRect = () => {
        reads += 1;
        return original();
      };
    }
    const nav = create({ container: "#group", items: "button", mode: "directional" });
    nav.focusIndex(0);
    for (let i = 0; i < 10; i++) press("ArrowRight");
    const afterFirstBatch = reads;
    expect(afterFirstBatch).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) press("ArrowLeft");
    expect(reads).toBe(afterFirstBatch);
  });
});

describe("skipping items", () => {
  it("never navigates to a disabled item", () => {
    const { items } = makeList(5, { disabled: [1, 2] });
    const nav = create({ container: "#group", items: "button" });
    expect(nav.items.map((element) => element.textContent)).toEqual(["item-0", "item-3", "item-4"]);
    nav.focusIndex(0);
    press("ArrowDown");
    expect(nav.activeElement).toBe(items[3]);
  });

  it("never navigates to a hidden item", () => {
    const { items } = makeList(4, { hidden: [1] });
    const nav = create({ container: "#group", items: "button" });
    expect(nav.items.map((element) => element.textContent)).toEqual(["item-0", "item-2", "item-3"]);
    nav.focusIndex(0);
    press("ArrowDown");
    expect(nav.activeElement).toBe(items[2]);
  });

  it("skips items removed by a filter", () => {
    makeList(4);
    const nav = create({
      container: "#group",
      items: "button",
      filter: (element) => !element.textContent?.endsWith("-1"),
    });
    expect(nav.items).toHaveLength(3);
  });

  it("honours aria-disabled", () => {
    const { container } = makeList(3);
    container.querySelectorAll("button")[1]!.setAttribute("aria-disabled", "true");
    const nav = create({ container: "#group", items: "button" });
    expect(nav.items).toHaveLength(2);
  });

  it("can be told to include disabled items", () => {
    makeList(3, { disabled: [1] });
    const nav = create({ container: "#group", items: "button", disabledSelector: false });
    expect(nav.items).toHaveLength(3);
  });

  it("can be told to include hidden items", () => {
    makeList(3, { hidden: [1] });
    const nav = create({ container: "#group", items: "button", skipHidden: false });
    expect(nav.items).toHaveLength(3);
  });
});

describe("activation", () => {
  it("fires onSelect for Enter and Space", () => {
    const { items } = makeList(3);
    const onSelect = vi.fn();
    const nav = create({ container: "#group", items: "button", onSelect });
    nav.focusIndex(1);

    press("Enter");
    expect(onSelect).toHaveBeenCalledWith(items[1], 1);
    press(" ");
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("does not fire onSelect when nothing is focused", () => {
    const onSelect = vi.fn();
    const nav = create({ container: "#group", items: "button", onSelect });
    void nav.items;
    press("Enter");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("supports programmatic selection of a specific item", () => {
    const { items } = makeList(3);
    const onSelect = vi.fn();
    const nav = create({ container: "#group", items: "button", onSelect });
    nav.select(items[2]);
    expect(onSelect).toHaveBeenCalledWith(items[2], 2);
    nav.select(0);
    expect(onSelect).toHaveBeenLastCalledWith(items[0], 0);
  });

  it("reports Escape without moving focus", () => {
    const { items } = makeList(3);
    const onEscape = vi.fn();
    const nav = create({ container: "#group", items: "button", onEscape });
    nav.focusIndex(1);
    press("Escape");
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(nav.activeElement).toBe(items[1]);
  });

  it("runs a custom action bound to a custom key", () => {
    const { items } = makeList(3);
    const onAction = vi.fn();
    const nav = create({
      container: "#group",
      items: "button",
      keys: { duplicate: "Ctrl+D" },
      onAction,
    });
    nav.focusIndex(1);
    press("d", { ctrlKey: true });
    expect(onAction.mock.calls.at(-1)?.[0]).toBe("duplicate");
    expect(onAction.mock.calls.at(-1)?.[2]).toBe(items[1]);
    expect(nav.perform("duplicate")).toBe(true);
  });
});

describe("lifecycle", () => {
  it("stops responding when disabled and resumes when enabled", () => {
    makeList(3);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(0);
    nav.disable();
    expect(nav.enabled).toBe(false);
    press("ArrowDown");
    expect(nav.activeIndex).toBe(0);
    nav.enable();
    expect(nav.enabled).toBe(true);
    press("ArrowDown");
    expect(nav.activeIndex).toBe(1);
  });

  it("can start disabled", () => {
    makeList(3);
    const nav = create({ container: "#group", items: "button", enabled: false });
    expect(nav.enabled).toBe(false);
    nav.focusIndex(0);
    press("ArrowDown");
    expect(nav.activeIndex).toBe(0);
  });

  it("does nothing after destroy", () => {
    makeList(3);
    const nav = createKeystra({ container: "#group", items: "button" });
    nav.focusIndex(0);
    nav.destroy();
    press("ArrowDown");
    expect(nav.next()).toBeNull();
    expect(nav.perform("next")).toBe(false);
    nav.destroy();
  });

  it("emits a destroy event exactly once", () => {
    makeList(2);
    const nav = createKeystra({ container: "#group", items: "button" });
    const onDestroy = vi.fn();
    nav.on("destroy", onDestroy);
    nav.destroy();
    nav.destroy();
    expect(onDestroy).toHaveBeenCalledTimes(1);
  });

  it("gates key handling on a predicate", () => {
    makeList(3);
    let open = false;
    const nav = create({ container: "#group", items: "button", when: () => open });
    nav.focusIndex(0);
    press("ArrowDown");
    expect(nav.activeIndex).toBe(0);
    open = true;
    press("ArrowDown");
    expect(nav.activeIndex).toBe(1);
  });

  it("updates loop, page size and keys at runtime", () => {
    makeList(4);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(3);
    press("ArrowDown");
    expect(nav.activeIndex).toBe(3);

    nav.update({ loop: true });
    press("ArrowDown");
    expect(nav.activeIndex).toBe(0);

    nav.update({ keys: { next: "j", previous: "k" } });
    press("ArrowDown");
    expect(nav.activeIndex).toBe(1);
    press("j");
    expect(nav.activeIndex).toBe(2);
    press("k");
    expect(nav.activeIndex).toBe(1);
    press("ArrowRight");
    expect(nav.activeIndex).toBe(1);

    nav.update({ pageSize: 2 });
    nav.focusIndex(0);
    press("PageDown");
    expect(nav.activeIndex).toBe(2);
  });

  it("switches mode at runtime and picks up the matching default keys", () => {
    makeList(4);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(0);
    press("ArrowRight");
    expect(nav.activeIndex).toBe(0);

    nav.update({ mode: "horizontal" });
    expect(nav.mode).toBe("horizontal");
    press("ArrowRight");
    expect(nav.activeIndex).toBe(1);
    press("ArrowDown");
    expect(nav.activeIndex).toBe(1);
  });
});

describe("autoFocus", () => {
  it("focuses the first item on creation", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", autoFocus: true });
    expect(nav.activeIndex).toBe(0);
    expect(document.activeElement).toBe(items[0]);
    press("ArrowDown");
    expect(nav.activeIndex).toBe(1);
  });

  it("can focus the last item", () => {
    const { items } = makeList(4);
    const nav = create({ container: "#group", items: "button", autoFocus: { enabled: true, target: "last" } });
    expect(nav.activeElement).toBe(items[3]);
  });

  it("can focus a computed index", () => {
    makeList(4);
    const nav = create({
      container: "#group",
      items: "button",
      autoFocus: { enabled: true, target: (list) => list.length - 2 },
    });
    expect(nav.activeIndex).toBe(2);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { createKeystra } from "../src/index.js";
import type { KeystraInstance } from "../src/types/index.js";
import { makeList, press, resetDom, tick } from "./helpers.js";

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

function appendItem(container: HTMLElement, label: string, position?: number): HTMLElement {
  const element = document.createElement("button");
  element.textContent = label;
  element.dataset.keystraItem = "";
  if (position === undefined) container.appendChild(element);
  else container.insertBefore(element, container.children[position] ?? null);
  return element;
}

describe("dynamically inserted elements", () => {
  it("picks up new items on the next key press without any observer", () => {
    const { container, items } = makeList(3);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(2);
    expect(nav.items).toHaveLength(3);

    const added = appendItem(container, "item-3");
    press("ArrowDown");
    expect(nav.activeElement).toBe(added);
    expect(nav.items).toHaveLength(4);
    expect(items).toHaveLength(3);
  });

  it("picks up items inserted in the middle, in DOM order", () => {
    const { container } = makeList(3);
    const nav = create({ container: "#group", items: "button" });
    appendItem(container, "inserted", 1);
    expect(nav.items.map((element) => element.textContent)).toEqual([
      "item-0",
      "inserted",
      "item-1",
      "item-2",
    ]);
  });

  it("can be refreshed explicitly", () => {
    const { container } = makeList(2);
    const nav = create({ container: "#group", items: "button" });
    expect(nav.items).toHaveLength(2);
    appendItem(container, "item-2");
    const items = nav.refresh();
    expect(items).toHaveLength(3);
  });

  it("emits refresh and calls onRefresh", () => {
    makeList(2);
    const onRefresh = vi.fn();
    const nav = create({ container: "#group", items: "button", onRefresh });
    const seen: number[] = [];
    nav.on("refresh", ({ items }) => seen.push(items.length));
    nav.refresh();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([2]);
  });
});

describe("removed elements", () => {
  it("drops removed items and keeps the cursor on a sensible neighbour", () => {
    const { container, items } = makeList(4);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(1);
    expect(nav.activeElement).toBe(items[1]);

    items[0]!.remove();
    press("ArrowDown");

    expect(nav.items).toHaveLength(3);
    expect(nav.activeElement).toBe(items[2]);
    expect(container.children).toHaveLength(3);

    nav.refresh();
    expect(nav.items.map((element) => element.textContent)).toEqual(["item-1", "item-2", "item-3"]);
  });

  it("clears the active element when the focused item is removed", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(1);
    items[1]!.remove();
    nav.refresh();
    expect(nav.currentIndex).toBe(-1);
    expect(nav.activeElement).toBeNull();
    expect(nav.items.filter((element) => element.getAttribute("tabindex") === "0")).toHaveLength(1);
  });

  it("keeps the cursor when an unrelated item is removed", () => {
    const { items } = makeList(4);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(1);
    items[3]!.remove();
    nav.refresh();
    expect(nav.currentIndex).toBe(1);
    expect(nav.activeElement).toBe(items[1]);
  });
});

describe("reordered elements", () => {
  it("follows the element, not the index", () => {
    const { container, items } = makeList(3);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(0);
    expect(nav.activeElement).toBe(items[0]);

    container.appendChild(items[0]!);
    nav.refresh();
    expect(nav.activeElement).toBe(items[0]);
    expect(nav.currentIndex).toBe(2);
  });
});

describe("updated disabled and hidden state", () => {
  it("drops an item that becomes disabled", () => {
    const { items } = makeList(4);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(0);
    expect(nav.items).toHaveLength(4);

    items[1]!.setAttribute("disabled", "");
    press("ArrowDown");
    expect(nav.items).toHaveLength(3);
    expect(nav.activeElement).toBe(items[2]);
  });

  it("drops an item that becomes aria-disabled", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button" });
    items[1]!.setAttribute("aria-disabled", "true");
    nav.refresh();
    expect(nav.items.map((element) => element.textContent)).toEqual(["item-0", "item-2"]);
  });

  it("drops an item that becomes hidden", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(0);
    items[1]!.setAttribute("hidden", "");
    press("ArrowDown");
    expect(nav.activeElement).toBe(items[2]);
  });

  it("drops a subtree hidden with inline display:none", () => {
    const { container, items } = makeList(4);
    const nav = create({ container: "#group", items: "button" });
    const wrapper = document.createElement("div");
    container.appendChild(wrapper);
    wrapper.appendChild(items[2]!);
    wrapper.appendChild(items[3]!);
    nav.refresh();
    expect(nav.items).toHaveLength(4);

    wrapper.style.display = "none";
    nav.refresh();
    expect(nav.items.map((element) => element.textContent)).toEqual(["item-0", "item-1"]);
  });

  it("accepts an item again once it is re-enabled", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button" });
    items[1]!.setAttribute("disabled", "");
    nav.refresh();
    expect(nav.items).toHaveLength(2);
    items[1]!.removeAttribute("disabled");
    nav.refresh();
    expect(nav.items).toHaveLength(3);
  });
});

describe("explicit registration", () => {
  it("adds items the selector does not match", () => {
    const { container } = makeList(2);
    const nav = create({ container: "#group", items: "button" });
    const extra = document.createElement("a");
    extra.textContent = "extra";
    extra.href = "#";
    container.appendChild(extra);

    expect(nav.items).toHaveLength(2);
    nav.add(extra);
    expect(nav.items).toHaveLength(3);
    expect(nav.items[2]).toBe(extra);
  });

  it("inserts added items in DOM order", () => {
    const { container, items } = makeList(2);
    const nav = create({ container: "#group", items: "button" });
    const extra = document.createElement("a");
    extra.textContent = "extra";
    container.insertBefore(extra, items[0]!);
    nav.add(extra);
    expect(nav.items.map((element) => element.textContent)).toEqual(["extra", "item-0", "item-1"]);
  });

  it("removes registered items again", () => {
    const { container } = makeList(2);
    const nav = create({ container: "#group", items: "button" });
    const extra = document.createElement("a");
    container.appendChild(extra);
    nav.add(extra);
    expect(nav.items).toHaveLength(3);
    nav.remove(extra);
    expect(nav.items).toHaveLength(2);
  });

  it("lets an explicit list replace the selector entirely", () => {
    const { items } = makeList(4);
    const nav = create({ container: "#group", items: "button" });
    nav.setItems([items[3]!, items[0]!]);
    expect(nav.items.map((element) => element.textContent)).toEqual(["item-3", "item-0"]);
    nav.setItems(null);
    expect(nav.items).toHaveLength(4);
  });

  it("accepts an array of items in add and remove", () => {
    const { container } = makeList(1);
    const nav = create({ container: "#group", items: "button" });
    const a = document.createElement("a");
    const b = document.createElement("a");
    container.append(a, b);
    nav.add([a, b]);
    expect(nav.items).toHaveLength(3);
    nav.remove([a, b]);
    expect(nav.items).toHaveLength(1);
  });

  it("ignores duplicate registrations", () => {
    const { container } = makeList(1);
    const nav = create({ container: "#group", items: "button" });
    const extra = document.createElement("a");
    container.appendChild(extra);
    nav.add(extra);
    nav.add(extra);
    expect(nav.items).toHaveLength(2);
  });
});

describe("function selectors", () => {
  it("accepts a callback that returns the items", () => {
    const { container } = makeList(4);
    const nav = create({
      container,
      items: (root) => Array.from(root.querySelectorAll<HTMLElement>("button")).filter((_, index) => index % 2 === 0),
    });
    expect(nav.items.map((element) => element.textContent)).toEqual(["item-0", "item-2"]);
  });

  it("re-runs the callback after a refresh", () => {
    const { container } = makeList(2);
    let limit = 1;
    const nav = create({
      container,
      items: (root) => Array.from(root.querySelectorAll<HTMLElement>("button")).slice(0, limit),
    });
    expect(nav.items).toHaveLength(1);
    limit = 2;
    nav.refresh();
    expect(nav.items).toHaveLength(2);
  });
});

describe("MutationObserver support", () => {
  it("invalidates the cache automatically when observe is on", async () => {
    const { container } = makeList(2);
    const nav = create({ container: "#group", items: "button", observe: true });
    expect(nav.items).toHaveLength(2);

    appendItem(container, "item-2");
    await tick(2);
    expect(nav.items).toHaveLength(3);
  });

  it("stays lazy when observe is off, and catches up on the next interaction", () => {
    const { container } = makeList(2);
    const nav = create({ container: "#group", items: "button" });
    expect(nav.items).toHaveLength(2);

    appendItem(container, "item-2");
    expect(nav.items).toHaveLength(2);

    nav.focusIndex(0);
    press("ArrowDown");
    expect(nav.items).toHaveLength(3);
    expect(nav.activeElement?.textContent).toBe("item-1");
  });

  it("accepts custom observer options", async () => {
    const { container, items } = makeList(2);
    const nav = create({
      container: "#group",
      items: "button",
      observe: { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] },
    });
    items[0]!.setAttribute("disabled", "");
    await tick(2);
    expect(nav.items).toHaveLength(1);
    expect(container.children).toHaveLength(2);
  });

  it("disconnects the observer on destroy", async () => {
    const { container } = makeList(2);
    const nav = createKeystra({ container: "#group", items: "button", observe: true });
    nav.destroy();
    appendItem(container, "item-2");
    await tick(2);
    expect(nav.items).toHaveLength(0);
  });
});

describe("nested containers", () => {
  it("treats a nested group as its own collection", () => {
    document.body.innerHTML = `
      <div id="outer">
        <button>o0</button>
        <div id="inner"><button>i0</button><button>i1</button></div>
        <button>o1</button>
      </div>`;
    const outer = create({
      container: "#outer",
      items: (root) => Array.from(root.children).filter((child) => child.tagName === "BUTTON") as HTMLElement[],
    });
    const inner = create({ container: "#inner", items: "button" });

    expect(outer.items.map((element) => element.textContent)).toEqual(["o0", "o1"]);
    expect(inner.items.map((element) => element.textContent)).toEqual(["i0", "i1"]);

    inner.focusIndex(0);
    press("ArrowDown");
    expect(inner.currentIndex).toBe(1);
    expect(outer.currentIndex).toBe(-1);
  });
});

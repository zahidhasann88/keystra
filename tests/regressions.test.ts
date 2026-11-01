import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCommandPalette,
  createDropdown,
  createGrid,
  createKeystra,
  createList,
  createMenu,
  createRovingFocus,
  createTabs,
  createTree,
  KeyMatcher,
  normalizeKeyEvent,
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

function makeMenu(hidden = false): { trigger: HTMLButtonElement; after: HTMLButtonElement; container: HTMLElement; items: HTMLElement[] } {
  const trigger = document.createElement("button");
  trigger.id = "trigger";
  document.body.appendChild(trigger);
  const { container, items } = makeList(3, { containerId: "menu" });
  if (hidden) container.setAttribute("hidden", "");
  const after = document.createElement("button");
  document.body.appendChild(after);
  return { trigger, after, container, items };
}

describe("grid options", () => {
  it("honours rowHomeEnd", () => {
    const { items } = makeList(6);
    const grid = track(createGrid({ container: "#group", items: "button", columns: 3, rowHomeEnd: true }));
    grid.focusIndex(4);
    press("End");
    expect(document.activeElement).toBe(items[5]);
    press("Home");
    expect(document.activeElement).toBe(items[3]);
  });

  it("honours maintainColumn: false", () => {
    const { items } = makeList(6);
    const grid = track(createGrid({ container: "#group", items: "button", columns: 3, maintainColumn: false }));
    grid.focusIndex(1);
    press("ArrowDown");
    expect(document.activeElement).toBe(items[3]);
  });

  it("applies a column count changed through update()", () => {
    const { items } = makeList(6);
    const nav = track(createKeystra({ container: "#group", items: "button", mode: "grid", columns: 3 }));
    nav.focusIndex(0);
    nav.update({ columns: 2 });
    press("ArrowDown");
    expect(document.activeElement).toBe(items[2]);
  });

  it("reports the updated column count on the grid pattern", () => {
    makeList(6);
    const grid = track(createGrid({ container: "#group", items: "button", columns: 3 }));
    grid.update({ columns: 2 });
    expect(grid.columns).toBe(2);
    expect(grid.rows).toBe(3);
  });
});

describe("update()", () => {
  it("keeps custom keys when the mode changes", () => {
    const { items } = makeList(3);
    const nav = track(createKeystra({ container: "#group", items: "button", keys: { next: "j" } }));
    nav.focusIndex(0);
    nav.update({ mode: "horizontal" });
    press("j");
    expect(document.activeElement).toBe(items[1]);
  });

  it("keeps useDefaultKeys: false when keys change", () => {
    makeList(3);
    const nav = track(createKeystra({ container: "#group", items: "button", useDefaultKeys: false, keys: { next: "j" } }));
    nav.focusIndex(0);
    nav.update({ keys: { next: "n" } });
    expect(pressed("ArrowDown")).toBe(true);
  });
});

describe("sequences", () => {
  const event = (key: string) => normalizeKeyEvent(new KeyboardEvent("keydown", { key }));

  it("resolves sequences that share a first key", () => {
    const matcher = new KeyMatcher({}, [
      { binding: ["g", "g"], action: "first" },
      { binding: ["g", "i"], action: "inbox" },
    ]);
    expect(matcher.match(event("g"))?.complete).toBe(false);
    expect(matcher.match(event("i"))).toMatchObject({ complete: true, actions: ["inbox"] });
    expect(matcher.match(event("g"))?.complete).toBe(false);
    expect(matcher.match(event("g"))).toMatchObject({ complete: true, actions: ["first"] });
    matcher.dispose();
  });
});

describe("native activation", () => {
  it("leaves Enter and Space to the browser when nothing handles them", () => {
    makeList(2);
    const nav = track(createKeystra({ container: "#group", items: "button" }));
    nav.focusIndex(0);
    expect(pressed("Enter")).toBe(true);
    expect(pressed(" ")).toBe(true);
  });

  it("still consumes Enter when the host handles it", () => {
    makeList(2);
    const onSelect = vi.fn();
    const nav = track(createKeystra({ container: "#group", items: "button", onSelect }));
    nav.focusIndex(0);
    expect(pressed("Enter")).toBe(false);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("lets Escape reach a surrounding dialog when nothing handles it", () => {
    makeList(2);
    const outer = vi.fn();
    document.body.addEventListener("keydown", outer);
    const nav = track(createKeystra({ container: "#group", items: "button" }));
    nav.focusIndex(0);
    expect(pressed("Escape")).toBe(true);
    expect(outer).toHaveBeenCalledTimes(1);
    document.body.removeEventListener("keydown", outer);
  });

  it("does not let a tab group swallow Escape", () => {
    makeList(2, { containerId: "tabs" });
    const tabs = track(createTabs({ container: "#tabs", items: "button" }));
    tabs.focusIndex(0);
    expect(pressed("Escape")).toBe(true);
  });
});

describe("declared options", () => {
  it("elements takes precedence over the selector", () => {
    const { items } = makeList(3);
    const nav = track(createKeystra({ container: "#group", items: "button", elements: [items[0]!, items[2]!] }));
    expect(nav.items).toEqual([items[0], items[2]]);
  });

  it("selectOnActivate: false keeps Enter from selecting", () => {
    makeList(2);
    const onSelect = vi.fn();
    const list = track(
      createList({ container: "#group", items: "button", onSelect, selection: { mode: "single", selectOnActivate: false } }),
    );
    list.focusIndex(0);
    press("Enter");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(list.selection!.selected).toHaveLength(0);
  });
});

describe("selection events", () => {
  it("toggle reports only the item that changed", () => {
    const { items } = makeList(3);
    const nav = track(createKeystra({ container: "#group", items: "button", selection: { mode: "multiple" } }));
    nav.selection!.select(0);
    const changes: { added: readonly Element[]; removed: readonly Element[] }[] = [];
    nav.on("selectionchange", ({ added, removed }) => changes.push({ added, removed }));

    nav.selection!.toggle(1);
    nav.selection!.toggle(1);
    expect(changes).toEqual([
      { added: [items[1]], removed: [] },
      { added: [], removed: [items[1]] },
    ]);
  });

  it("deselect does not report remaining items as added", () => {
    const { items } = makeList(3);
    const nav = track(createKeystra({ container: "#group", items: "button", selection: { mode: "multiple" } }));
    nav.selection!.select(0);
    nav.selection!.select(1);
    const onChange = vi.fn();
    nav.on("selectionchange", onChange);
    nav.selection!.deselect(0);
    expect(onChange.mock.calls[0]![0]).toMatchObject({ added: [], removed: [items[0]] });
  });

  it("drops the anchor when toggle removes it", () => {
    const { items } = makeList(3);
    const nav = track(createKeystra({ container: "#group", items: "button", selection: { mode: "multiple" } }));
    nav.selection!.select(0);
    nav.selection!.select(1);
    nav.selection!.toggle(0);
    expect(nav.selection!.anchor).toBe(items[1]);
  });
});

describe("menu and dropdown", () => {
  it("opens a menu that is hidden in the markup, and hides it again", () => {
    const { trigger, container, items } = makeMenu(true);
    const menu = track(createMenu({ container: "#menu" }));
    trigger.focus();
    menu.open();
    expect(container.hasAttribute("hidden")).toBe(false);
    expect(document.activeElement).toBe(items[0]);
    menu.close();
    expect(container.hasAttribute("hidden")).toBe(true);
  });

  it("toggleHidden: false leaves the attribute to the host", () => {
    const { container } = makeMenu(true);
    const menu = track(createMenu({ container: "#menu", toggleHidden: false }));
    menu.open();
    expect(container.hasAttribute("hidden")).toBe(true);
  });

  it("reopens at the previous item after focus went elsewhere", () => {
    const { trigger, items } = makeMenu();
    const menu = track(createMenu({ container: "#menu" }));
    trigger.focus();
    menu.open();
    press("ArrowDown");
    menu.close();
    menu.open({ focus: "current" });
    expect(document.activeElement).toBe(items[1]);
  });

  it("closes on Tab from a menu item, returning to the trigger first", () => {
    const { trigger } = makeMenu();
    const dropdown = track(createDropdown({ trigger: "#trigger", container: "#menu" }));
    trigger.focus();
    dropdown.open();
    expect(pressed("Tab")).toBe(true);
    expect(dropdown.isOpen).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("leaves a dropdown open when the host bound Tab itself", () => {
    const { trigger } = makeMenu();
    const dropdown = track(createDropdown({ trigger: "#trigger", container: "#menu", keys: { next: "Tab" } }));
    trigger.focus();
    dropdown.open();
    press("Tab");
    expect(dropdown.isOpen).toBe(true);
  });
});

describe("tabs", () => {
  it("fires onSelect once for a manual activation", () => {
    makeList(2, { containerId: "tabs" });
    const onSelect = vi.fn();
    const tabs = track(createTabs({ container: "#tabs", items: "button", activation: "manual", onSelect }));
    tabs.focusIndex(1);
    press("Enter");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe("tree", () => {
  function makeTree(): { outer: HTMLElement; inner: HTMLElement } {
    document.body.innerHTML = `
      <ul id="tree" role="tree">
        <li role="treeitem" id="outer" aria-expanded="false">Outer
          <ul role="group" hidden>
            <li role="treeitem" id="inner" aria-expanded="false">Inner
              <ul role="group" hidden><li role="treeitem">Leaf</li></ul>
            </li>
          </ul>
        </li>
      </ul>`;
    return { outer: document.getElementById("outer")!, inner: document.getElementById("inner")! };
  }

  it("expandAll reaches nested nodes", () => {
    const { inner } = makeTree();
    const tree = track(createTree({ container: "#tree", toggleHidden: true }));
    tree.expandAll();
    expect(inner.getAttribute("aria-expanded")).toBe("true");
    expect(tree.items).toHaveLength(3);
  });

  it('collapseBehavior: "hidden" hides the group', () => {
    const { outer } = makeTree();
    const tree = track(createTree({ container: "#tree", collapseBehavior: "hidden" }));
    tree.expand(outer);
    expect(outer.querySelector("ul")!.hasAttribute("hidden")).toBe(false);
  });

  it("passes the real index to a user filter with hiddenClass", () => {
    makeTree();
    const seen: number[] = [];
    const tree = track(
      createTree({
        container: "#tree",
        hiddenClass: "closed",
        skipHidden: false,
        filter: (_element, index) => {
          seen.push(index);
          return true;
        },
      }),
    );
    expect(tree.items).toHaveLength(3);
    expect(seen.slice(0, 3)).toEqual([0, 1, 2]);
  });
});

describe("command palette", () => {
  function makePalette(withInput = true): { input: HTMLInputElement | null; list: HTMLElement } {
    document.body.innerHTML = `
      <div id="palette" hidden>
        ${withInput ? '<input id="search" />' : ""}
        <div id="results"><div class="row">Open</div><div class="row">Save</div></div>
      </div>`;
    return { input: document.querySelector("input"), list: document.getElementById("results")! };
  }

  it("binds keys with a selector container and no input", () => {
    makePalette(false);
    const onSelect = vi.fn();
    const palette = track(createCommandPalette({ container: "#palette", items: ".row", onSelect }));
    const keydown = vi.spyOn(palette as unknown as { onKeydown(event: KeyboardEvent): void }, "onKeydown");
    press("ArrowDown", { target: document.getElementById("results")! });
    expect(keydown).toHaveBeenCalled();
  });

  it("presents the field as a combobox over the list option", () => {
    const { input, list } = makePalette();
    const palette = track(createCommandPalette({ container: "#palette", list: "#results", items: ".row" }));
    expect(input!.getAttribute("role")).toBe("combobox");
    expect(input!.getAttribute("aria-expanded")).toBe("false");
    expect(input!.getAttribute("aria-controls")).toBe("results");
    expect(list.getAttribute("role")).toBe("listbox");
    expect(document.getElementById("palette")!.getAttribute("role")).toBeNull();
    palette.open();
    expect(palette.items[0]!.getAttribute("role")).toBe("option");
  });

  it("submits the raw query when there is no result to pick", () => {
    const { input, list } = makePalette();
    list.innerHTML = "";
    const onSubmit = vi.fn();
    const palette = track(createCommandPalette({ container: "#palette", items: ".row", onSubmit }));
    palette.open();
    input!.value = "nothing";
    expect(pressed("Enter", { target: input! })).toBe(false);
    expect(onSubmit).toHaveBeenCalledWith(null, "nothing");
  });

  it("removes aria-activedescendant on destroy", () => {
    const { input } = makePalette();
    const palette = createCommandPalette({ container: "#palette", items: ".row" });
    palette.open();
    expect(input!.hasAttribute("aria-activedescendant")).toBe(true);
    palette.destroy();
    expect(input!.hasAttribute("aria-activedescendant")).toBe(false);
  });
});

describe("roving focus", () => {
  it('mode: "horizontal" restricts the group to one axis', () => {
    const { items } = makeList(3);
    const group = track(createRovingFocus({ container: "#group", items: "button", mode: "horizontal" }));
    group.focusIndex(0);
    expect(pressed("ArrowDown")).toBe(true);
    expect(document.activeElement).toBe(items[0]);
    press("ArrowRight");
    expect(document.activeElement).toBe(items[1]);
  });
});

describe("paging", () => {
  it("pageDown() sees items added since the last read", () => {
    const { container, items } = makeList(2);
    const nav = track(createKeystra({ container: "#group", items: "button", pageSize: 5 }));
    nav.focusIndex(0);
    const added = document.createElement("button");
    container.appendChild(added);
    expect(nav.pageDown()).toBe(added);
    expect(items).toHaveLength(2);
  });
});

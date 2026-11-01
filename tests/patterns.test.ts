import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCommandPalette,
  createDropdown,
  createGrid,
  createList,
  createMenu,
  createRovingFocus,
  createTabs,
  createTree,
} from "../src/index.js";
import { makeList, press, pressed, resetDom, stubGridLayout } from "./helpers.js";

const instances: { destroy(): void }[] = [];

function track<T extends { destroy(): void }>(instance: T): T {
  instances.push(instance);
  return instance;
}

afterEach(() => {
  while (instances.length > 0) instances.pop()!.destroy();
  resetDom();
});

function makeTablist(count = 3): { list: HTMLElement; tabs: HTMLElement[]; panels: HTMLElement[] } {
  const list = document.createElement("div");
  list.id = "tabs";
  document.body.appendChild(list);

  const tabs: HTMLElement[] = [];
  const panels: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const tab = document.createElement("button");
    tab.textContent = `Tab ${i}`;
    tab.dataset.keystraItem = "";
    list.appendChild(tab);
    tabs.push(tab);

    const panel = document.createElement("section");
    panel.id = `panel-${i}`;
    panel.textContent = `Panel ${i}`;
    document.body.appendChild(panel);
    panels.push(panel);
  }
  return { list, tabs, panels };
}

describe("createTabs", () => {
  it("activates a tab as soon as it is focused", () => {
    const { tabs } = makeTablist();
    const instance = track(createTabs({ container: "#tabs", panels: "section" }));

    expect(instance.activeIndex).toBe(0);
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
    expect(tabs[1]!.getAttribute("aria-selected")).toBe("false");

    press("ArrowRight", { target: tabs[0] });

    expect(instance.activeIndex).toBe(1);
    expect(instance.activeTab).toBe(tabs[1]);
    expect(tabs[1]!.getAttribute("aria-selected")).toBe("true");
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("false");
  });

  it("uses the horizontal arrow keys by default and loops", () => {
    const { tabs } = makeTablist();
    track(createTabs({ container: "#tabs" }));

    press("ArrowDown", { target: tabs[0] });
    expect(document.activeElement).not.toBe(tabs[1]);

    tabs[0]!.focus();
    press("ArrowLeft", { target: tabs[0] });
    expect(document.activeElement).toBe(tabs[2]);
  });

  it("switches to up and down when the orientation is vertical", () => {
    const { list, tabs } = makeTablist();
    const instance = track(createTabs({ container: "#tabs", orientation: "vertical" }));

    expect(instance.orientation).toBe("vertical");
    expect(list.getAttribute("aria-orientation")).toBe("vertical");

    press("ArrowDown", { target: tabs[0] });
    expect(instance.activeIndex).toBe(1);

    press("ArrowUp", { target: tabs[1] });
    expect(instance.activeIndex).toBe(0);
  });

  it("keeps exactly one tab in the tab order", () => {
    const { tabs } = makeTablist();
    track(createTabs({ container: "#tabs" }));

    expect(tabs[0]!.getAttribute("tabindex")).toBe("0");
    expect(tabs[1]!.getAttribute("tabindex")).toBe("-1");

    press("ArrowRight", { target: tabs[0] });

    expect(tabs[0]!.getAttribute("tabindex")).toBe("-1");
    expect(tabs[1]!.getAttribute("tabindex")).toBe("0");
  });

  it("links each tab to its panel and hides the inactive panels", () => {
    const { tabs, panels } = makeTablist();
    track(createTabs({ container: "#tabs", panels: "section" }));

    expect(tabs[0]!.getAttribute("aria-controls")).toBe("panel-0");
    expect(panels[0]!.getAttribute("aria-labelledby")).toBe(tabs[0]!.id);
    expect(panels[0]!.hasAttribute("hidden")).toBe(false);
    expect(panels[1]!.hasAttribute("hidden")).toBe(true);

    press("ArrowRight", { target: tabs[0] });

    expect(panels[0]!.hasAttribute("hidden")).toBe(true);
    expect(panels[1]!.hasAttribute("hidden")).toBe(false);
  });

  it("waits for Enter when activation is manual", () => {
    const onActivate = vi.fn();
    const { tabs } = makeTablist();
    const instance = track(
      createTabs({ container: "#tabs", activation: "manual", onActivate }),
    );

    press("ArrowRight", { target: tabs[0] });
    expect(document.activeElement).toBe(tabs[1]);
    expect(instance.activeIndex).toBe(0);
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
    expect(onActivate).not.toHaveBeenCalled();

    press("Enter", { target: tabs[1] });
    expect(instance.activeIndex).toBe(1);
    expect(onActivate).toHaveBeenCalledWith(tabs[1], 1);
  });

  it("honours a pre-selected tab in the markup", () => {
    const { tabs } = makeTablist();
    tabs[2]!.setAttribute("aria-selected", "true");
    const instance = track(createTabs({ container: "#tabs" }));

    expect(instance.activeIndex).toBe(2);
    expect(tabs[2]!.getAttribute("tabindex")).toBe("0");
  });

  it("activates programmatically and reports the change once", () => {
    const onActivate = vi.fn();
    const { tabs } = makeTablist();
    const instance = track(createTabs({ container: "#tabs", onActivate }));

    instance.activate(2);
    expect(instance.activeIndex).toBe(2);
    expect(document.activeElement).toBe(tabs[2]);
    expect(onActivate).toHaveBeenCalledTimes(1);

    instance.activate(tabs[2]!);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("writes nothing to the DOM when aria is off", () => {
    const { list, tabs } = makeTablist();
    track(createTabs({ container: "#tabs", aria: false }));

    expect(list.hasAttribute("role")).toBe(false);
    expect(list.hasAttribute("aria-orientation")).toBe(false);
    expect(tabs[0]!.hasAttribute("role")).toBe(false);
    expect(tabs[0]!.hasAttribute("aria-selected")).toBe(false);
    expect(tabs[0]!.id).toBe("");

    press("ArrowRight", { target: tabs[0] });
    expect(document.activeElement).toBe(tabs[1]);
  });

  it("does not overwrite roles the author already wrote", () => {
    const { list, tabs } = makeTablist();
    list.setAttribute("role", "toolbar");
    tabs[0]!.setAttribute("role", "button");
    track(createTabs({ container: "#tabs" }));

    expect(list.getAttribute("role")).toBe("toolbar");
    expect(tabs[0]!.getAttribute("role")).toBe("button");
    expect(tabs[1]!.getAttribute("role")).toBe("tab");
  });
});

function makeMenu(count = 4): { container: HTMLElement; items: HTMLElement[]; opener: HTMLElement } {
  const opener = document.createElement("button");
  opener.id = "menu-button";
  opener.textContent = "Actions";
  document.body.appendChild(opener);

  const container = document.createElement("div");
  container.id = "menu";
  document.body.appendChild(container);

  const items: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const item = document.createElement("button");
    item.textContent = ["Copy", "Cut", "Paste", "Delete"][i] ?? `Item ${i}`;
    item.dataset.keystraItem = "";
    container.appendChild(item);
    items.push(item);
  }
  return { container, items, opener };
}

describe("createMenu", () => {
  it("ignores keys while closed and works once opened", () => {
    const { items } = makeMenu();
    const menu = track(createMenu({ container: "#menu" }));

    expect(menu.isOpen).toBe(false);
    items[0]!.focus();
    expect(pressed("ArrowDown", { target: items[0] })).toBe(true);
    expect(document.activeElement).toBe(items[0]);

    menu.open();
    expect(menu.isOpen).toBe(true);
    expect(document.activeElement).toBe(items[0]);

    press("ArrowDown");
    expect(document.activeElement).toBe(items[1]);
  });

  it("fills in the menu roles and marks the open state", () => {
    const { container, items } = makeMenu();
    const menu = track(createMenu({ container: "#menu" }));

    expect(container.getAttribute("role")).toBe("menu");
    expect(items[0]!.getAttribute("role")).toBe("menuitem");

    menu.open();
    expect(container.getAttribute("data-keystra-open")).toBe("true");
    menu.close({ restoreFocus: false });
    expect(container.hasAttribute("data-keystra-open")).toBe(false);
  });

  it("leaves roles alone when aria is off", () => {
    const { container, items } = makeMenu();
    const menu = track(createMenu({ container: "#menu", aria: false }));

    expect(container.hasAttribute("role")).toBe(false);
    expect(items[0]!.hasAttribute("role")).toBe(false);
    menu.open();
    expect(container.hasAttribute("data-keystra-open")).toBe(false);
  });

  it("can open on the last item or on a specific index", () => {
    const { items } = makeMenu();
    const menu = track(createMenu({ container: "#menu" }));

    menu.open({ focus: "last" });
    expect(document.activeElement).toBe(items[3]);
    menu.close({ restoreFocus: false });

    menu.open({ focus: 1 });
    expect(document.activeElement).toBe(items[1]);
  });

  it("keeps its place when reopened with focus: current", () => {
    const { items } = makeMenu();
    const menu = track(createMenu({ container: "#menu" }));

    menu.open();
    press("ArrowDown");
    press("ArrowDown");
    expect(document.activeElement).toBe(items[2]);

    menu.close({ restoreFocus: false });
    menu.open({ focus: "current" });
    expect(document.activeElement).toBe(items[2]);
  });

  it("closes on Escape and returns focus to the opener", () => {
    const { opener, items } = makeMenu();
    const onClose = vi.fn();
    const menu = track(createMenu({ container: "#menu", returnFocusTo: "#menu-button", onClose }));

    opener.focus();
    menu.open();
    press("ArrowDown");
    press("Escape");

    expect(menu.isOpen).toBe(false);
    expect(document.activeElement).toBe(opener);
    expect(onClose).toHaveBeenCalledWith(menu);
    expect(items[0]!.contains(document.activeElement)).toBe(false);
  });

  it("closes after a selection by default and reports the choice", () => {
    const { items, opener } = makeMenu();
    const onSelect = vi.fn();
    const menu = track(createMenu({ container: "#menu", returnFocusTo: "#menu-button", onSelect }));

    opener.focus();
    menu.open();
    press("ArrowDown");
    press("Enter");

    expect(onSelect).toHaveBeenCalledWith(items[1], 1);
    expect(menu.isOpen).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it("stays open when closeOnSelect is false", () => {
    const { items } = makeMenu();
    const menu = track(createMenu({ container: "#menu", closeOnSelect: false }));

    menu.open();
    press("Enter");
    expect(menu.isOpen).toBe(true);
    expect(document.activeElement).toBe(items[0]);
  });

  it("jumps to an item when its first letter is typed", () => {
    const { items } = makeMenu();
    const menu = track(createMenu({ container: "#menu" }));

    menu.open();
    press("p");
    expect(document.activeElement).toBe(items[2]);

    press("d");
    expect(document.activeElement).toBe(items[3]);
  });

  it("toggle() flips between open and closed", () => {
    makeMenu();
    const menu = track(createMenu({ container: "#menu" }));

    menu.toggle();
    expect(menu.isOpen).toBe(true);
    menu.toggle();
    expect(menu.isOpen).toBe(false);
  });
});

describe("createDropdown", () => {
  it("opens from the trigger with Enter, Space and either arrow key", () => {
    const { items } = makeMenu();
    const dropdown = track(createDropdown({ container: "#menu", trigger: "#menu-button" }));
    const trigger = dropdown.trigger!;

    for (const key of ["Enter", " ", "ArrowDown"]) {
      press(key, { target: trigger });
      expect(dropdown.isOpen, key).toBe(true);
      expect(document.activeElement).toBe(items[0]);
      dropdown.close({ restoreFocus: false });
    }

    press("ArrowUp", { target: trigger });
    expect(dropdown.isOpen).toBe(true);
    expect(document.activeElement).toBe(items[3]);
  });

  it("does not open on an unrelated key", () => {
    makeMenu();
    const dropdown = track(createDropdown({ container: "#menu", trigger: "#menu-button" }));

    press("x", { target: dropdown.trigger! });
    expect(dropdown.isOpen).toBe(false);
  });

  it("maintains aria-expanded, aria-haspopup and aria-controls on the trigger", () => {
    const { container } = makeMenu();
    const dropdown = track(createDropdown({ container: "#menu", trigger: "#menu-button" }));
    const trigger = dropdown.trigger!;

    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-controls")).toBe(container.id);

    dropdown.open();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    dropdown.close({ restoreFocus: false });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("respects an aria-haspopup the author already set", () => {
    const { opener } = makeMenu();
    opener.setAttribute("aria-haspopup", "listbox");
    const dropdown = track(createDropdown({ container: "#menu", trigger: "#menu-button" }));

    expect(dropdown.trigger!.getAttribute("aria-haspopup")).toBe("listbox");
  });

  it("returns focus to the trigger on Escape", () => {
    const { items } = makeMenu();
    const dropdown = track(createDropdown({ container: "#menu", trigger: "#menu-button" }));
    const trigger = dropdown.trigger!;

    trigger.focus();
    press("ArrowDown", { target: trigger });
    expect(document.activeElement).toBe(items[0]);

    press("Escape");
    expect(dropdown.isOpen).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on Tab instead of trapping focus", () => {
    makeMenu();
    const dropdown = track(createDropdown({ container: "#menu", trigger: "#menu-button" }));
    const trigger = dropdown.trigger!;

    dropdown.open();
    expect(pressed("Tab")).toBe(true);
    press("Tab", { target: trigger });
    expect(dropdown.isOpen).toBe(false);
  });

  it("accepts custom open keys", () => {
    makeMenu();
    const dropdown = track(
      createDropdown({ container: "#menu", trigger: "#menu-button", openKeys: ["Ctrl+Shift+M"] }),
    );
    const trigger = dropdown.trigger!;

    press("ArrowDown", { target: trigger });
    expect(dropdown.isOpen).toBe(false);

    press("m", { target: trigger, ctrlKey: true, shiftKey: true });
    expect(dropdown.isOpen).toBe(true);
  });

  it("closes on a pointer down outside the menu", () => {
    makeMenu();
    const dropdown = track(createDropdown({ container: "#menu", trigger: "#menu-button" }));

    dropdown.open();
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(dropdown.isOpen).toBe(false);
  });

  it("stays open for a pointer down inside the menu", () => {
    const { items } = makeMenu();
    const dropdown = track(createDropdown({ container: "#menu", trigger: "#menu-button" }));

    dropdown.open();
    items[1]!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(dropdown.isOpen).toBe(true);
  });
});

describe("createList", () => {
  it("selects with the arrow keys out of the box", () => {
    const { items } = makeList(4);
    const list = track(createList({ container: "#group", items: "button" }));

    list.focusIndex(0);
    expect(list.selection?.selected).toEqual([items[0]]);

    press("ArrowDown");
    expect(list.selection?.selected).toEqual([items[1]]);
  });

  it("fills in a missing listbox role", () => {
    const { container } = makeList(2);
    track(createList({ container: "#group", items: "button" }));
    expect(container.getAttribute("role")).toBe("listbox");
  });

  it("supports typeahead", () => {
    const { items } = makeList(3, { labels: ["apple", "banana", "cherry"] });
    const list = track(createList({ container: "#group", items: "button" }));

    list.focusIndex(0);
    press("c");
    expect(document.activeElement).toBe(items[2]);
  });

  it("can be configured for multi-select", () => {
    const { items } = makeList(3);
    const list = track(
      createList({ container: "#group", items: "button", selection: { mode: "multiple" } }),
    );

    list.focusIndex(0);
    press("Space");
    press("ArrowDown");
    press("Space");
    expect(list.selection?.selected).toEqual([items[0], items[1]]);
  });
});

describe("createGrid", () => {
  it("infers the column count from geometry", () => {
    const { items } = makeList(9);
    stubGridLayout(items, 3);
    const grid = track(createGrid({ container: "#group", items: "button" }));

    expect(grid.columns).toBe(3);
    expect(grid.rows).toBe(3);
  });

  it("moves within a row and keeps the column between rows", () => {
    const { items } = makeList(9);
    stubGridLayout(items, 3);
    const grid = track(createGrid({ container: "#group", items: "button" }));

    grid.focusIndex(0);
    expect(grid.position).toEqual({ row: 0, column: 0 });

    press("ArrowRight");
    expect(grid.position).toEqual({ row: 0, column: 1 });

    press("ArrowDown");
    expect(grid.position).toEqual({ row: 1, column: 1 });
    expect(document.activeElement).toBe(items[4]);

    press("ArrowLeft");
    press("ArrowUp");
    expect(grid.position).toEqual({ row: 0, column: 0 });
  });

  it("reads no geometry at all when the column count is declared", () => {
    const { items } = makeList(9);
    let reads = 0;
    for (const item of items) {
      item.getBoundingClientRect = () => {
        reads++;
        return { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0 } as DOMRect;
      };
    }

    const grid = track(createGrid({ container: "#group", items: "button", columns: 3 }));
    grid.focusIndex(0);
    press("ArrowRight");
    press("ArrowDown");

    expect(reads).toBe(0);
    expect(grid.position).toEqual({ row: 1, column: 1 });
  });

  it("focuses a cell by row and column", () => {
    const { items } = makeList(9);
    stubGridLayout(items, 3);
    const grid = track(createGrid({ container: "#group", items: "button" }));

    expect(grid.focusCell(2, 1)).toBe(items[7]);
    expect(document.activeElement).toBe(items[7]);
    expect(grid.position).toEqual({ row: 2, column: 1 });
  });

  it("handles a short last row without walking off the end", () => {
    const { items } = makeList(8);
    stubGridLayout(items, 3);
    const grid = track(createGrid({ container: "#group", items: "button" }));

    expect(grid.rows).toBe(3);

    grid.focusCell(1, 2);
    expect(document.activeElement).toBe(items[5]);
    press("ArrowDown");
    expect(grid.position).toEqual({ row: 2, column: 1 });
    expect(document.activeElement).toBe(items[7]);

    grid.focusCell(2, 0);
    press("ArrowRight");
    expect(document.activeElement).toBe(items[7]);
    press("ArrowRight");
    expect(document.activeElement).toBe(items[7]);
  });

  it("wraps inside the row, never into a row that is not there", () => {
    const { items } = makeList(8);
    stubGridLayout(items, 3);
    const grid = track(createGrid({ container: "#group", items: "button", loop: true }));

    grid.focusCell(2, 1);
    expect(document.activeElement).toBe(items[7]);

    press("ArrowRight");
    expect(grid.position).toEqual({ row: 2, column: 0 });
    expect(document.activeElement).toBe(items[6]);

    press("ArrowLeft");
    expect(document.activeElement).toBe(items[7]);
  });

  it("writes no roles into markup that has no rows", () => {
    const { container, items } = makeList(4);
    stubGridLayout(items, 2);
    const grid = track(createGrid({ container: "#group", items: "button" }));

    expect(container.hasAttribute("role")).toBe(false);
    expect(items[0]!.hasAttribute("role")).toBe(false);
    expect(grid.columns).toBe(2);
  });

  it("completes the grid roles when the author supplied rows", () => {
    const container = document.createElement("div");
    container.id = "grid";
    document.body.appendChild(container);

    const cells: HTMLElement[] = [];
    for (let row = 0; row < 2; row++) {
      const rowElement = document.createElement("div");
      rowElement.setAttribute("role", "row");
      container.appendChild(rowElement);
      for (let column = 0; column < 3; column++) {
        const cell = document.createElement("button");
        cell.textContent = `cell-${row}-${column}`;
        cell.dataset.keystraItem = "";
        rowElement.appendChild(cell);
        cells.push(cell);
      }
    }
    stubGridLayout(cells, 3);

    const grid = track(createGrid({ container: "#grid", items: "button", columns: 3 }));
    expect(container.getAttribute("role")).toBe("grid");
    expect(cells[0]!.getAttribute("role")).toBe("gridcell");
    expect(grid.rows).toBe(2);

    grid.focusIndex(0);
    press("ArrowRight");
    press("ArrowDown");
    expect(grid.position).toEqual({ row: 1, column: 1 });
    expect(document.activeElement).toBe(cells[4]);
  });
});

function labelsOf(nodes: readonly HTMLElement[]): string[] {
  return nodes.map((node) => node.dataset.label ?? node.textContent ?? "");
}

function makeTree(): { container: HTMLElement; nodes: Record<string, HTMLElement> } {
  const container = document.createElement("ul");
  container.id = "tree";
  document.body.appendChild(container);

  const nodes: Record<string, HTMLElement> = {};

  const documents = document.createElement("li");
  documents.setAttribute("role", "treeitem");
  documents.dataset.label = "Documents";
  documents.textContent = "Documents";
  documents.dataset.keystraItem = "";
  container.appendChild(documents);
  nodes.documents = documents;

  const group = document.createElement("ul");
  group.setAttribute("role", "group");
  group.setAttribute("hidden", "");
  documents.appendChild(group);

  for (const name of ["resume", "cover"]) {
    const leaf = document.createElement("li");
    leaf.setAttribute("role", "treeitem");
    leaf.dataset.label = name;
    leaf.textContent = name;
    leaf.dataset.keystraItem = "";
    group.appendChild(leaf);
    nodes[name] = leaf;
  }

  const pictures = document.createElement("li");
  pictures.setAttribute("role", "treeitem");
  pictures.dataset.label = "Pictures";
  pictures.textContent = "Pictures";
  pictures.dataset.keystraItem = "";
  container.appendChild(pictures);
  nodes.pictures = pictures;

  return { container, nodes };
}

describe("createTree", () => {
  it("only navigates the visible nodes", () => {
    const { nodes } = makeTree();
    const tree = track(createTree({ container: "#tree", toggleHidden: true }));

    expect(labelsOf(tree.items)).toEqual(["Documents", "Pictures"]);

    tree.focusIndex(0);
    press("ArrowDown");
    expect(document.activeElement).toBe(nodes.pictures);
  });

  it("expands with ArrowRight and reveals the children", () => {
    const { nodes } = makeTree();
    const onExpand = vi.fn();
    const tree = track(createTree({ container: "#tree", toggleHidden: true, onExpand }));

    tree.focusIndex(0);
    expect(tree.isExpandable(nodes.documents!)).toBe(true);
    expect(tree.isExpanded(nodes.documents!)).toBe(false);

    press("ArrowRight");

    expect(tree.isExpanded(nodes.documents!)).toBe(true);
    expect(nodes.documents!.getAttribute("aria-expanded")).toBe("true");
    expect(onExpand).toHaveBeenCalledWith(nodes.documents, 0);
    expect(labelsOf(tree.items)).toEqual(["Documents", "resume", "cover", "Pictures"]);
  });

  it("descends into an already open node with a second ArrowRight", () => {
    const { nodes } = makeTree();
    const tree = track(createTree({ container: "#tree", toggleHidden: true }));

    tree.focusIndex(0);
    press("ArrowRight");
    expect(tree.isExpanded(nodes.documents!)).toBe(true);
    expect(document.activeElement).toBe(nodes.documents);

    press("ArrowRight");
    expect(document.activeElement).toBe(nodes.resume);
  });

  it("collapses with ArrowLeft and ascends to the parent afterwards", () => {
    const { nodes } = makeTree();
    const tree = track(createTree({ container: "#tree", toggleHidden: true }));

    tree.expand(nodes.documents);
    tree.focusElement(nodes.resume!);
    expect(document.activeElement).toBe(nodes.resume);

    press("ArrowLeft");
    expect(document.activeElement).toBe(nodes.documents);

    press("ArrowLeft");
    expect(tree.isExpanded(nodes.documents!)).toBe(false);
    expect(tree.items).toHaveLength(2);
  });

  it("reports the level and the parent of a node", () => {
    const { nodes } = makeTree();
    const tree = track(createTree({ container: "#tree", toggleHidden: true }));

    expect(tree.level(nodes.documents!)).toBe(0);
    expect(tree.parent(nodes.documents!)).toBeNull();

    tree.expand(nodes.documents);
    expect(tree.level(nodes.resume!)).toBe(1);
    expect(tree.parent(nodes.resume!)).toBe(nodes.documents);
  });

  it("expands and collapses everything at once", () => {
    const { nodes } = makeTree();
    const tree = track(createTree({ container: "#tree", toggleHidden: true }));

    tree.expandAll();
    expect(tree.isExpanded(nodes.documents!)).toBe(true);
    expect(tree.items).toHaveLength(4);

    tree.collapseAll();
    expect(tree.isExpanded(nodes.documents!)).toBe(false);
    expect(tree.items).toHaveLength(2);
  });

  it("leaves the DOM alone when the host wants to drive visibility itself", () => {
    const { nodes } = makeTree();
    const group = nodes.documents!.querySelector("ul")!;
    const tree = track(createTree({ container: "#tree" }));

    tree.expand(nodes.documents);
    expect(nodes.documents!.getAttribute("aria-expanded")).toBe("true");
    expect(group.hasAttribute("hidden")).toBe(true);
    expect(tree.items).toHaveLength(2);
  });

  it("writes no aria-expanded when aria is off", () => {
    const { nodes } = makeTree();
    const tree = track(createTree({ container: "#tree", aria: false, toggleHidden: true }));

    tree.expand(nodes.documents);
    expect(nodes.documents!.hasAttribute("aria-expanded")).toBe(false);
    expect(nodes.documents!.querySelector("ul")!.hasAttribute("hidden")).toBe(false);
  });
});

function makePalette(): {
  container: HTMLElement;
  input: HTMLInputElement;
  results: HTMLElement[];
} {
  const container = document.createElement("div");
  container.id = "palette";
  container.setAttribute("hidden", "");
  document.body.appendChild(container);

  const input = document.createElement("input");
  input.type = "text";
  input.id = "palette-input";
  container.appendChild(input);

  const list = document.createElement("div");
  list.id = "palette-results";
  container.appendChild(list);

  const results: HTMLElement[] = [];
  for (const label of ["Open file", "Open folder", "Save"]) {
    const row = document.createElement("button");
    row.textContent = label;
    row.dataset.keystraItem = "";
    list.appendChild(row);
    results.push(row);
  }
  return { container, input, results };
}

describe("createCommandPalette", () => {
  it("opens on the global shortcut and focuses the input", () => {
    const { container, input } = makePalette();
    const palette = track(
      createCommandPalette({ container: "#palette", items: "button", openKeys: ["Ctrl+K"] }),
    );

    expect(palette.isOpen).toBe(false);
    expect(container.hasAttribute("hidden")).toBe(true);

    press("k", { ctrlKey: true, target: document.body });

    expect(palette.isOpen).toBe(true);
    expect(container.hasAttribute("hidden")).toBe(false);
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps focus in the input while the arrow keys move the list cursor", () => {
    const { input, results } = makePalette();
    const palette = track(createCommandPalette({ container: "#palette", items: "button" }));

    palette.open();
    expect(document.activeElement).toBe(input);

    press("ArrowDown", { target: input });
    expect(document.activeElement).toBe(input);
    expect(palette.currentIndex).toBe(1);

    press("ArrowDown", { target: input });
    expect(palette.currentIndex).toBe(2);
    expect(palette.activeElement).toBe(results[2]);
  });

  it("submits the highlighted row on Enter without leaving the field", () => {
    const { input } = makePalette();
    const onSubmit = vi.fn();
    const palette = track(
      createCommandPalette({ container: "#palette", items: "button", onSubmit }),
    );

    palette.open();
    input.value = "open";
    press("ArrowDown", { target: input });
    expect(pressed("Enter", { target: input })).toBe(false);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![1]).toBe("open");
    expect(document.activeElement).toBe(input);
  });

  it("closes on Escape, hides the container and restores focus", () => {
    const opener = document.createElement("button");
    opener.id = "menu-button";
    document.body.appendChild(opener);
    makePalette();

    const onCancel = vi.fn();
    const palette = track(
      createCommandPalette({ container: "#palette", items: "button", onCancel }),
    );

    opener.focus();
    palette.open();
    press("Escape", { target: palette.input! });

    expect(palette.isOpen).toBe(false);
    expect(onCancel).toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
    expect(document.getElementById("palette")!.hasAttribute("hidden")).toBe(true);
  });

  it("reports query changes and can set the query itself", () => {
    const { input } = makePalette();
    const onQuery = vi.fn();
    const palette = track(
      createCommandPalette({ container: "#palette", items: "button", onQuery }),
    );

    palette.open();
    input.value = "save";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onQuery).toHaveBeenCalledWith("save");
    expect(palette.query).toBe("save");

    palette.setQuery("open");
    expect(input.value).toBe("open");
    expect(onQuery).toHaveBeenLastCalledWith("open");

    palette.setQuery("open");
    expect(onQuery).toHaveBeenCalledTimes(2);
  });

  it("resets the cursor when the results change", () => {
    const { input, container } = makePalette();
    const palette = track(createCommandPalette({ container: "#palette", items: "button" }));

    palette.open();
    press("ArrowDown", { target: input });
    press("ArrowDown", { target: input });
    expect(palette.currentIndex).toBe(2);

    const list = container.querySelector("#palette-results")!;
    list.innerHTML = "";
    const only = document.createElement("button");
    only.textContent = "Save";
    only.dataset.keystraItem = "";
    list.appendChild(only);

    input.value = "s";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(palette.currentIndex).toBe(0);
    expect(palette.items).toHaveLength(1);
  });

  it("links the input to the list for assistive technology", () => {
    const { input } = makePalette();
    track(createCommandPalette({ container: "#palette", items: "button", placeholder: "Search…" }));

    expect(input.getAttribute("aria-controls")).toBe("palette");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(input.getAttribute("placeholder")).toBe("Search…");
    expect(document.getElementById("palette")!.getAttribute("role")).toBe("listbox");
  });

  it("only consumes the keys it owns, leaving editing to the browser", () => {
    const { input } = makePalette();
    const palette = track(createCommandPalette({ container: "#palette", items: "button" }));
    palette.open();

    expect(pressed("a", { target: input })).toBe(true);
    expect(pressed("Backspace", { target: input })).toBe(true);
    expect(pressed("ArrowLeft", { target: input })).toBe(true);
    expect(pressed("Home", { target: input, shiftKey: true })).toBe(true);

    expect(pressed("ArrowDown", { target: input })).toBe(false);
    expect(pressed("ArrowUp", { target: input })).toBe(false);
    expect(pressed("Escape", { target: input })).toBe(false);
    expect(palette.isOpen).toBe(false);
  });
});

describe("createRovingFocus", () => {
  it("keeps a single tab stop and moves it with the arrow keys", () => {
    const { items } = makeList(4);
    const group = track(createRovingFocus({ container: "#group", items: "button" }));

    expect(items.map((item) => item.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1"]);

    items[0]!.focus();
    press("ArrowDown");
    expect(items.map((item) => item.getAttribute("tabindex"))).toEqual(["-1", "0", "-1", "-1"]);
    expect(document.activeElement).toBe(items[1]);
    expect(group.currentIndex).toBe(1);
  });

  it("starts from the element the author marked as the tab stop", () => {
    const { items } = makeList(3);
    items[2]!.setAttribute("tabindex", "0");
    const group = track(createRovingFocus({ container: "#group", items: "button" }));

    expect(items[2]!.getAttribute("tabindex")).toBe("0");
    expect(items[0]!.getAttribute("tabindex")).toBe("-1");
    expect(group.currentIndex).toBe(2);
  });

  it("honours an explicit initial index", () => {
    const { items } = makeList(3);
    const group = track(createRovingFocus({ container: "#group", items: "button", initialIndex: 1 }));

    expect(group.currentIndex).toBe(1);
    expect(items[1]!.getAttribute("tabindex")).toBe("0");
  });

  it("restores the authored tabindex values on destroy", () => {
    const { items } = makeList(3);
    items[1]!.setAttribute("tabindex", "3");
    const group = createRovingFocus({ container: "#group", items: "button" });

    expect(items[1]!.getAttribute("tabindex")).toBe("-1");
    group.destroy();
    expect(items[1]!.getAttribute("tabindex")).toBe("3");
    expect(items[0]!.hasAttribute("tabindex")).toBe(false);
  });
});

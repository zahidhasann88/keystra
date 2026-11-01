import type { TreeInstance, TreeOptions } from "../types/index.js";
import { NavigationController } from "../core/engine.js";
import { TREE_KEYS } from "../core/default-keys.js";
import { ensureItemRoles, ensureRole, setAria } from "./shared.js";

const DEFAULT_ITEM_SELECTOR = "[role='treeitem']";
const DEFAULT_GROUP_SELECTOR = "[role='group']";

class TreeController<T extends HTMLElement = HTMLElement>
  extends NavigationController<T>
  implements TreeInstance<T>
{
  private readonly groupSelector: string;
  private readonly manageAria: boolean;
  private readonly toggleHiddenValue: boolean;
  private readonly hiddenClassValue: string | undefined;
  private readonly collapseBehavior: "attribute" | "hidden" | "none";
  private readonly userOnExpand: TreeOptions<T>["onExpand"];
  private readonly userOnCollapse: TreeOptions<T>["onCollapse"];

  constructor(options: TreeOptions<T>) {
    const hiddenClass = options.hiddenClass;
    super(
      {
        typeahead: true,
        items: (options.items ?? DEFAULT_ITEM_SELECTOR) as TreeOptions<T>["items"],
        ...options,
        filter: hiddenClass
          ? (element: T, index: number) => {
              if (options.filter && !options.filter(element, index)) return false;
              const group = element.parentElement?.closest(`.${hiddenClass}`);
              return !group;
            }
          : options.filter,
      },
      {
        mode: options.mode ?? "vertical",
        loop: options.loop ?? false,
        defaultKeys: TREE_KEYS,
      },
    );

    this.groupSelector = options.groupSelector ?? DEFAULT_GROUP_SELECTOR;
    this.manageAria = options.aria !== false;
    this.collapseBehavior = options.collapseBehavior ?? "attribute";
    this.toggleHiddenValue = options.toggleHidden === true || this.collapseBehavior === "hidden";
    this.hiddenClassValue = options.hiddenClass;
    this.userOnExpand = options.onExpand;
    this.userOnCollapse = options.onCollapse;

    if (this.manageAria && this.container) ensureRole(this.container, "tree", true);
    this.decorateItems();

    this.on("action", ({ action, element }) => {
      if (!element) return;
      if (action === "expand") this.handleExpandKey(element);
      else if (action === "collapse") this.handleCollapseKey(element);
    });
  }

  private decorateItems(): void {
    ensureItemRoles(this.container, this.items, "tree", "treeitem", this.manageAria);
    this.on("refresh", () => {
      ensureItemRoles(this.container, this.items, "tree", "treeitem", this.manageAria);
    });
  }

  isExpandable(element: T): boolean {
    if (element.hasAttribute("aria-expanded")) return true;
    if (element.hasAttribute("data-expandable")) return true;
    return element.querySelector(this.groupSelector) !== null;
  }

  isExpanded(element: T): boolean {
    const value = element.getAttribute("aria-expanded");
    if (value !== null) return value === "true";
    const group = element.querySelector(this.groupSelector);
    if (!group) return false;
    if (this.hiddenClassValue) return !group.classList.contains(this.hiddenClassValue);
    return !group.hasAttribute("hidden");
  }

  expand(elementOrIndex?: T | number): void {
    const element = this.elementOf(elementOrIndex);
    if (!element || !this.isExpandable(element)) return;
    if (this.isExpanded(element)) return;
    this.setExpanded(element, true);
  }

  collapse(elementOrIndex?: T | number): void {
    const element = this.elementOf(elementOrIndex);
    if (!element || !this.isExpandable(element)) return;
    if (!this.isExpanded(element)) return;
    this.setExpanded(element, false);
  }

  toggleExpanded(elementOrIndex?: T | number): void {
    const element = this.elementOf(elementOrIndex);
    if (!element || !this.isExpandable(element)) return;
    this.setExpanded(element, !this.isExpanded(element));
  }

  expandAll(): void {
    const visited = new Set<T>();
    for (let pending = true; pending; ) {
      pending = false;
      for (const element of this.items) {
        if (visited.has(element)) continue;
        visited.add(element);
        if (!this.isExpandable(element) || this.isExpanded(element)) continue;
        this.setExpanded(element, true);
        pending = true;
      }
    }
  }

  collapseAll(): void {
    for (const element of this.items) if (this.isExpandable(element)) this.setExpanded(element, false);
  }

  level(element: T): number {
    let depth = 0;
    let node: Element | null = element.parentElement;
    while (node && node !== this.container) {
      if (this.matchesGroup(node)) depth++;
      node = node.parentElement;
    }
    return depth;
  }

  parent(element: T): T | null {
    const items = this.items;
    let node: Element | null = element.parentElement;
    while (node && node !== this.container) {
      if (items.indexOf(node as T) !== -1) return node as T;
      node = node.parentElement;
    }
    return null;
  }

  private elementOf(elementOrIndex?: T | number): T | null {
    if (elementOrIndex === undefined) return this.activeElement;
    if (typeof elementOrIndex === "number") return this.items[elementOrIndex] ?? null;
    return elementOrIndex;
  }

  private matchesGroup(node: Element): boolean {
    if (typeof node.matches === "function") {
      try {
        return node.matches(this.groupSelector);
      } catch {
        return false;
      }
    }
    return false;
  }

  private setExpanded(element: T, expanded: boolean): void {
    if (this.collapseBehavior !== "none") {
      setAria(element, "aria-expanded", expanded ? "true" : "false", this.manageAria);
    }

    const group = element.querySelector(this.groupSelector);
    if (group) {
      if (this.toggleHiddenValue) {
        if (group.hasAttribute("hidden") === expanded) group.toggleAttribute("hidden", !expanded);
      }
      if (this.hiddenClassValue) group.classList.toggle(this.hiddenClassValue, !expanded);
    }

    this.refresh();

    if (expanded) this.userOnExpand?.(element, this.items.indexOf(element));
    else this.userOnCollapse?.(element, this.items.indexOf(element));
  }

  private handleExpandKey(element: T): void {
    if (!this.isExpandable(element)) return;
    if (!this.isExpanded(element)) {
      this.setExpanded(element, true);
      return;
    }
    const index = this.items.indexOf(element);
    if (index !== -1 && index + 1 < this.items.length) this.focusIndex(index + 1);
  }

  private handleCollapseKey(element: T): void {
    if (this.isExpandable(element) && this.isExpanded(element)) {
      this.setExpanded(element, false);
      return;
    }
    const parent = this.parent(element);
    if (parent) this.focusElement(parent);
  }
}

export function createTree<T extends HTMLElement = HTMLElement>(options: TreeOptions<T> = {}): TreeInstance<T> {
  return new TreeController<T>(options);
}

import type { ItemSelector, NavigationStrategyContext } from "../types/index.js";
import { isDisabled, isHidden, queryItems } from "../utils/dom.js";
import { LayoutCache } from "../utils/layout.js";

export interface ItemCollectionOptions<T extends Element> {
  selector: ItemSelector<T>;
  disabledSelector: string | null;
  skipHidden: boolean;
  filter?: ((element: T, index: number) => boolean) | null;
  observe: boolean | MutationObserverInit;
}

const groups = new Map<Element, number>();

function claimGroup(container: Element | null): void {
  if (container) groups.set(container, (groups.get(container) ?? 0) + 1);
}

function releaseGroup(container: Element | null): void {
  if (!container) return;
  const count = groups.get(container) ?? 0;
  if (count <= 1) groups.delete(container);
  else groups.set(container, count - 1);
}

function groupsInside(container: Element | null): Element[] {
  const inside: Element[] = [];
  if (!container) return inside;
  for (const group of groups.keys()) {
    if (group !== container && container.contains(group)) inside.push(group);
  }
  return inside;
}

export class ItemCollection<T extends Element = HTMLElement> {
  private list: T[] = [];
  private extra: T[] = [];
  private removed = new WeakSet<T>();
  private explicit: T[] | null = null;
  private built = false;
  private observer: MutationObserver | null = null;
  private observerKey = "";

  readonly layout = new LayoutCache();
  private _version = 0;

  constructor(
    private container: Element | null,
    private options: ItemCollectionOptions<T>,
    private onInvalidate?: () => void,
  ) {
    claimGroup(container);
  }

  get version(): number {
    return this._version;
  }

  get items(): readonly T[] {
    if (!this.built) this.build();
    return this.list;
  }

  get size(): number {
    return this.items.length;
  }

  setContainer(container: Element | null): void {
    if (this.container === container) return;
    releaseGroup(this.container);
    claimGroup(container);
    this.container = container;
    this.invalidate();
  }

  setItems(elements: readonly T[] | null): void {
    this.explicit = elements ? elements.slice() : null;
    this.invalidate();
  }

  add(element: T | readonly T[]): void {
    const additions = Array.isArray(element) ? (element as readonly T[]) : [element as T];
    for (const item of additions) {
      if (!item || this.extra.includes(item)) continue;
      this.removed.delete(item);
      this.extra.push(item);
    }
    this.invalidate();
  }

  remove(element: T | readonly T[]): void {
    const removals = Array.isArray(element) ? (element as readonly T[]) : [element as T];
    for (const item of removals) {
      const index = this.extra.indexOf(item);
      if (index !== -1) this.extra.splice(index, 1);
      this.removed.add(item);
    }
    this.invalidate();
  }

  invalidate(): void {
    this.built = false;
    this.onInvalidate?.();
  }

  refresh(): readonly T[] {
    this.build();
    return this.list;
  }

  revalidate(): void {
    if (this.observer) return;
    const before = this.list;
    this.build();
    if (this.list !== before) this.onInvalidate?.();
  }

  indexOf(element: T | null | undefined): number {
    if (!element) return -1;
    return this.items.indexOf(element);
  }

  at(index: number): T | null {
    return this.items[index] ?? null;
  }

  startObserving(): void {
    if (!this.options.observe) {
      this.stopObserving();
      return;
    }
    const key = `${this.container ? "c" : "n"}:${JSON.stringify(this.options.observe)}`;
    if (this.observer && this.observerKey === key) return;
    this.stopObserving();
    if (!this.container || typeof MutationObserver !== "function") return;
    const init: MutationObserverInit =
      typeof this.options.observe === "object"
        ? this.options.observe
        : { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "aria-disabled", "hidden", "style", "class"] };
    this.observer = new MutationObserver(() => this.invalidate());
    this.observer.observe(this.container, init);
    this.observerKey = key;
  }

  stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      this.observerKey = "";
    }
  }

  dispose(): void {
    this.stopObserving();
    releaseGroup(this.container);
    this.list = [];
    this.extra = [];
    this.removed = new WeakSet();
    this.explicit = null;
    this.built = false;
    this.container = null;
    this.onInvalidate = undefined;
  }

  private build(): void {
    const { selector, disabledSelector, skipHidden, filter } = this.options;
    let source: T[];
    let nested: Element[] = [];

    if (this.explicit) {
      source = this.explicit.slice();
    } else {
      source = queryItems<T>(this.container, selector);
      nested = groupsInside(this.container);
      if (this.extra.length > 0) {
        const merged = source.slice();
        for (const item of this.extra) if (!merged.includes(item)) merged.push(item);
        source = sortInDomOrder(merged);
      }
    }

    const result: T[] = [];
    for (let i = 0; i < source.length; i++) {
      const element = source[i]!;
      if (!element || this.removed.has(element)) continue;
      if (nested.length > 0 && nested.some((group) => group !== element && group.contains(element))) continue;
      if (disabledSelector && isDisabled(element, disabledSelector)) continue;
      if (skipHidden && isHidden(element)) continue;
      if (filter && !filter(element, result.length)) continue;
      result.push(element);
    }

    if (sameList(this.list, result)) {
      this.built = true;
      this.startObserving();
      return;
    }
    this._version++;
    this.list = result;
    this.built = true;
    this.startObserving();
  }
}

function sameList<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function sortInDomOrder<T extends Element>(elements: T[]): T[] {
  if (elements.length < 2) return elements;
  if (typeof document === "undefined" || elements[0]?.compareDocumentPosition == null) return elements;
  return elements.slice().sort((a, b) => {
    if (a === b) return 0;
    const position = a.compareDocumentPosition(b);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

export function createRectOf<T extends Element>(
  collection: ItemCollection<T>,
): NavigationStrategyContext<T>["rectOf"] {
  return (element: T) => collection.layout.rect(element, collection.version);
}

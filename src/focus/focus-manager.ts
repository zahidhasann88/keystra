import type { KeyAction, RovingOptions } from "../types/index.js";
import { contains, ensureId, focusElement as focusDomElement, isDisabled, isHidden } from "../utils/dom.js";
import { RovingTabindex } from "./roving-focus.js";

export interface FocusManagerOptions<T extends Element = HTMLElement> {
  readonly roving?: boolean | RovingOptions;
  readonly preventScroll?: boolean;
  readonly disabledSelector?: string | null;
  readonly skipHidden?: boolean;
  readonly onFocus?: (element: T, index: number, action: KeyAction | null) => void;
  readonly onBlur?: (element: T, index: number) => void;
  readonly virtual?: boolean;
  readonly descendantOwner?: (() => Element | null) | null;
}

export class FocusManager<T extends Element = HTMLElement> {
  readonly roving: RovingTabindex<T>;

  private items: readonly T[] = [];
  private activeElement: T | null = null;
  private activeIndex = -1;
  private outsideElement: HTMLElement | null = null;
  private lastInsideElement: T | null = null;
  private lastKnownIndex = 0;
  private cleared = false;
  private started = false;
  private readonly rovingEnabled: boolean;
  private readonly options: FocusManagerOptions<T>;
  private readonly virtual: boolean;
  private container: Element | null = null;
  private markedOption: T | null = null;

  constructor(options: FocusManagerOptions<T> = {}) {
    this.options = options;
    this.virtual = options.virtual === true;
    const roving = options.roving;
    this.rovingEnabled = roving !== false && (typeof roving !== "object" || roving.enabled !== false);
    this.roving = new RovingTabindex<T>({
      disabled: !this.rovingEnabled,
      respectNegative: typeof roving === "object" ? roving.force !== true : true,
    });
  }

  get element(): T | null {
    return this.activeElement;
  }

  get index(): number {
    return this.activeIndex;
  }

  get focusedIndex(): number {
    if (this.activeIndex < 0) return -1;
    if (this.virtual) return this.activeIndex;
    if (typeof document === "undefined") return this.activeIndex;
    const active = document.activeElement;
    const current = this.activeElement;
    if (!current) return -1;
    if (active === (current as unknown as Node)) return this.activeIndex;
    if (active && contains(current, active)) return this.activeIndex;
    return -1;
  }

  get previousElement(): HTMLElement | null {
    return this.outsideElement;
  }

  get lastFocused(): T | null {
    return this.lastInsideElement;
  }

  sync(items: readonly T[], container?: Element | null): number {
    const previous = this.activeElement;
    if (this.activeIndex >= 0) this.lastKnownIndex = this.activeIndex;
    this.items = items;
    if (container !== undefined) this.container = container;

    if (previous) {
      const index = items.indexOf(previous);
      if (index !== -1 && this.isUsable(previous)) {
        this.activeIndex = index;
        this.promote(previous, items);
        return index;
      }
    }

    const fromDocument = previous || !this.cleared ? this.readActiveFromDocument(container) : -1;
    if (fromDocument >= 0) {
      const element = items[fromDocument]!;
      this.activeElement = element;
      this.activeIndex = fromDocument;
      this.lastInsideElement = element;
      this.lastKnownIndex = fromDocument;
      this.promote(element, items);
      return fromDocument;
    }

    this.activeElement = null;
    this.activeIndex = -1;

    let candidate: T | null = null;
    if (previous && items.length > 0) {
      const previousIndex = this.lastKnownIndex;
      candidate = items[Math.min(previousIndex, items.length - 1)] ?? items[0] ?? null;
    } else if (!this.started && items.length > 0) {
      candidate = this.roving.authoredTabStop(items) ?? items[0] ?? null;
      const index = candidate ? items.indexOf(candidate) : -1;
      if (index > 0 && candidate && this.isUsable(candidate)) {
        this.activeElement = candidate;
        this.activeIndex = index;
        this.lastInsideElement = candidate;
        this.lastKnownIndex = index;
      }
    } else {
      candidate = items[0] ?? null;
    }
    this.started = true;
    this.promote(candidate, items);
    return this.activeIndex;
  }

  private promote(element: T | null, items: readonly T[]): void {
    this.roving.sync(this.virtual ? null : element, items);
    this.writeActiveDescendant(this.virtual ? element : null);
  }

  private writeActiveDescendant(element: T | null): void {
    if (!this.virtual) return;
    this.markOption(element);
    const owner = this.options.descendantOwner?.() ?? null;
    if (!owner) return;
    if (!element) {
      if (owner.hasAttribute("aria-activedescendant")) owner.removeAttribute("aria-activedescendant");
      return;
    }
    const id = ensureId(element, "keystra-item");
    if (owner.getAttribute("aria-activedescendant") !== id) {
      owner.setAttribute("aria-activedescendant", id);
    }
  }

  private markOption(element: T | null): void {
    if (this.markedOption === element) return;
    if (this.markedOption) this.markedOption.setAttribute("aria-selected", "false");
    this.markedOption = element?.getAttribute("role") === "option" ? element : null;
    if (this.markedOption) this.markedOption.setAttribute("aria-selected", "true");
  }

  observe(element: Element | null, container: Element | null): void {
    if (!element) return;
    if (container && !contains(container, element)) return;
    const index = this.items.indexOf(element as T);
    if (index === -1) return;
    const item = this.items[index]!;
    this.activeElement = item;
    this.activeIndex = index;
    this.lastInsideElement = item;
    this.lastKnownIndex = index;
    if (!this.virtual) this.roving.apply(item);
    this.writeActiveDescendant(item);
  }

  focusIndex(index: number, action: KeyAction | null = null, preventScroll?: boolean, moveFocus = true): T | null {
    const items = this.items;
    if (index < 0 || index >= items.length) return null;
    const element = items[index]!;
    if (!this.isUsable(element)) return null;

    const previous = this.activeElement;
    if (previous && previous !== element) {
      const previousIndex = items.indexOf(previous);
      if (previousIndex !== -1) this.options.onBlur?.(previous, previousIndex);
    }

    this.captureOutside(previous);

    this.activeElement = element;
    this.activeIndex = index;
    this.cleared = false;
    this.lastInsideElement = element;
    this.lastKnownIndex = index;

    if (this.virtual) this.writeActiveDescendant(element);
    else this.roving.move(element);
    if (moveFocus && !this.virtual) {
      focusDomElement(element as unknown as HTMLElement, preventScroll ?? this.options.preventScroll !== false);
    }

    this.options.onFocus?.(element, index, action);
    return element;
  }

  setActiveIndex(index: number): void {
    const element = index >= 0 ? (this.items[index] ?? null) : null;
    this.activeElement = element;
    this.activeIndex = element ? index : -1;
    if (element) {
      this.cleared = false;
      this.lastInsideElement = element;
      this.lastKnownIndex = index;
    } else {
      this.cleared = index < 0;
    }
    this.promote(element ?? this.items[0] ?? null, this.items);
  }

  focusElement(element: T | null, action: KeyAction | null = null): boolean {
    if (!element) return false;
    const index = this.items.indexOf(element);
    if (index === -1) return false;
    return this.focusIndex(index, action) !== null;
  }

  restore(): boolean {
    const target = this.outsideElement;
    if (target && typeof target.focus === "function" && !isHidden(target) && !isDisabled(target)) {
      focusDomElement(target, this.options.preventScroll !== false);
      return true;
    }
    if (this.virtual) return false;
    if (this.lastInsideElement && this.items.indexOf(this.lastInsideElement) !== -1) {
      return this.focusElement(this.lastInsideElement);
    }
    return this.focusIndex(this.activeIndex) !== null;
  }

  remember(element: HTMLElement | null): void {
    if (element) this.outsideElement = element;
  }

  clear(): void {
    this.activeElement = null;
    this.activeIndex = -1;
    this.items = [];
    this.lastInsideElement = null;
    this.lastKnownIndex = 0;
  }

  dispose(): void {
    this.writeActiveDescendant(null);
    this.roving.restore();
    this.clear();
    this.outsideElement = null;
  }

  private isUsable(element: T): boolean {
    if (!element) return false;
    if (isDisabled(element, this.options.disabledSelector ?? null)) return false;
    if (this.options.skipHidden !== false && isHidden(element)) return false;
    return true;
  }

  private captureOutside(current: T | null): void {
    if (typeof document === "undefined") return;
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body || active === document.documentElement) return;
    if (current && active === (current as unknown as HTMLElement)) return;
    if (this.items.indexOf(active as unknown as T) !== -1) return;
    if (this.container && contains(this.container, active)) return;
    this.outsideElement = active;
  }

  private readActiveFromDocument(container?: Element | null): number {
    if (typeof document === "undefined") return -1;
    const active = document.activeElement;
    if (!active || active === document.body) return -1;
    const index = this.items.indexOf(active as unknown as T);
    if (index !== -1) return index;
    if (container) {
      for (let i = 0; i < this.items.length; i++) {
        if (contains(this.items[i], active)) return i;
      }
    }
    return -1;
  }
}

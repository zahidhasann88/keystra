export interface RovingTabindexOptions {
  readonly respectNegative?: boolean;
  readonly disabled?: boolean;
}

export class RovingTabindex<T extends Element = HTMLElement> {
  private readonly current = new WeakMap<Element, string>();
  private readonly originals = new Map<Element, string | null>();
  private active: T | null = null;
  private readonly respectNegative: boolean;
  private readonly disabled: boolean;

  constructor(options: RovingTabindexOptions = {}) {
    this.respectNegative = options.respectNegative !== false;
    this.disabled = options.disabled === true;
  }

  get activeElement(): T | null {
    return this.active;
  }

  sync(element: T | null, others: readonly T[]): void {
    if (this.disabled) return;
    const desired = element ? this.desiredFor(element) : null;
    for (let i = 0; i < others.length; i++) {
      const item = others[i]!;
      if (item === element) continue;
      this.write(item, "-1");
    }
    this.active = element;
    if (element && desired !== null) this.write(element, desired);
    this.forgetDetached(others.length);
  }

  move(element: T): void {
    if (this.disabled) return;
    const desired = this.desiredFor(element);
    if (this.active && this.active !== element) this.write(this.active, "-1");
    this.active = element;
    this.write(element, desired);
  }

  private forgetDetached(live: number): void {
    if (this.originals.size <= live) return;
    for (const element of this.originals.keys()) {
      if (!element.isConnected) this.originals.delete(element);
    }
  }

  authoredTabStop(items: readonly T[]): T | null {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const authored = this.originals.has(item)
        ? this.originals.get(item)
        : item.getAttribute("tabindex");
      if (authored === "0") return item;
    }
    return null;
  }

  apply(element: T | null): void {
    if (this.disabled) return;
    this.active = element;
    if (element) this.write(element, this.desiredFor(element));
  }

  private desiredFor(element: Element): string {
    if (this.respectNegative) {
      const authored = this.originals.has(element)
        ? this.originals.get(element)
        : element.getAttribute("tabindex");
      if (authored === "-1") return "-1";
    }
    return "0";
  }

  private write(element: Element, value: string): void {
    if (this.current.get(element) === value) return;
    if (!this.originals.has(element)) this.originals.set(element, element.getAttribute("tabindex"));
    element.setAttribute("tabindex", value);
    this.current.set(element, value);
  }

  restore(): void {
    for (const [element, value] of this.originals) {
      if (value === null) element.removeAttribute("tabindex");
      else element.setAttribute("tabindex", value);
      this.current.delete(element);
    }
    this.originals.clear();
    this.active = null;
  }

  get touched(): number {
    return this.originals.size;
  }
}

import type { SelectionController, SelectionMode, SelectionOptions } from "../types/index.js";
import { setAttribute, toggleClass } from "../utils/dom.js";

export type SelectionDiffHandler<T extends Element> = (
  selected: readonly T[],
  added: readonly T[],
  removed: readonly T[],
) => void;

export class SelectionManager<T extends Element = HTMLElement> implements SelectionController<T> {
  private selectedItems: T[] = [];
  private itemsValue: readonly T[] = [];
  private provider: (() => readonly T[]) | null = null;
  private anchorElement: T | null = null;
  private modeValue: SelectionMode;
  private readonly options: SelectionOptions<T>;
  private readonly attribute: string | null;
  private readonly selectedClass: string | undefined;
  private readonly aria: boolean;
  private readonly touched = new Set<T>();
  private onDiff: SelectionDiffHandler<T> | null = null;
  private needsInitial = true;

  constructor(options: SelectionOptions<T> = {}) {
    this.options = options;
    this.modeValue = options.mode ?? "single";
    this.attribute = options.attribute ?? null;
    this.selectedClass = options.selectedClass;
    this.aria = options.aria === true;
  }

  get mode(): SelectionMode {
    return this.modeValue;
  }

  get selected(): readonly T[] {
    return this.selectedItems;
  }

  get items(): readonly T[] {
    return this.provider ? this.provider() : this.itemsValue;
  }

  get selectedIndexes(): readonly number[] {
    const result: number[] = [];
    for (let i = 0; i < this.selectedItems.length; i++) {
      const index = this.items.indexOf(this.selectedItems[i]!);
      if (index !== -1) result.push(index);
    }
    return result.sort((a, b) => a - b);
  }

  get anchor(): T | null {
    return this.anchorElement;
  }

  get size(): number {
    return this.selectedItems.length;
  }

  bindItems(provider: (() => readonly T[]) | null): void {
    this.provider = provider;
  }

  setDiffHandler(handler: SelectionDiffHandler<T> | null): void {
    this.onDiff = handler;
  }

  sync(items: readonly T[]): void {
    if (this.itemsValue === items && !this.needsInitial) return;
    this.itemsValue = items;
    const current = this.items;

    if (this.needsInitial) {
      this.needsInitial = false;
      this.applyInitial(this.options.initial);
    }

    if (this.aria || this.attribute || this.selectedClass) {
      for (let i = 0; i < current.length; i++) {
        const element = current[i]!;
        this.paint(element, this.selectedItems.indexOf(element) !== -1);
      }
    }

    if (this.touched.size > current.length) {
      for (const element of this.touched) {
        if (!element.isConnected && this.selectedItems.indexOf(element) === -1) this.touched.delete(element);
      }
    }

    if (this.selectedItems.length === 0 && this.anchorElement === null) return;

    let changed = false;
    const kept: T[] = [];
    for (const element of this.selectedItems) {
      if (current.indexOf(element) !== -1) kept.push(element);
      else {
        this.paint(element, false);
        changed = true;
      }
    }
    if (this.anchorElement && current.indexOf(this.anchorElement) === -1) {
      this.anchorElement = kept[0] ?? null;
      changed = true;
    }
    if (changed) {
      const previous = this.selectedItems;
      this.selectedItems = kept;
      this.options.onChange?.(this.selectedItems);
      this.onDiff?.(this.selectedItems, [], previous.filter((element) => kept.indexOf(element) === -1));
    }
  }

  applyInitial(initial: SelectionOptions<T>["initial"]): void {
    if (initial == null) return;
    const current = this.items;
    if (typeof initial === "number") {
      const element = current[initial];
      if (element) this.select(element);
      return;
    }
    const list = Array.isArray(initial) ? (initial as readonly T[]) : [initial as T];
    for (const element of list) if (element) this.select(element, this.modeValue !== "single");
  }

  select(elementOrIndex: T | number | undefined, extend = false): void {
    if (this.modeValue === "none") return;
    const element = this.resolve(elementOrIndex);
    if (!element) return;

    if (this.modeValue === "single" || (!extend && this.modeValue !== "multiple")) {
      if (this.selectedItems.length === 1 && this.selectedItems[0] === element) {
        this.anchorElement = element;
        return;
      }
      const removed = this.selectedItems.slice();
      this.selectedItems = [element];
      this.anchorElement = element;
      for (const item of removed) this.paint(item, false);
      this.paint(element, true);
      this.emit(removed);
      return;
    }

    if (this.modeValue === "range" && extend && this.anchorElement) {
      this.selectRange(this.anchorElement, element);
      return;
    }

    if (this.selectedItems.indexOf(element) === -1) {
      const previous = this.selectedItems.slice();
      this.selectedItems.push(element);
      this.paint(element, true);
      this.emit(previous);
    }
    if (!this.anchorElement) this.anchorElement = element;
  }

  toggle(elementOrIndex: T | number | undefined): void {
    if (this.modeValue === "none") return;
    const element = this.resolve(elementOrIndex);
    if (!element) return;
    if (this.modeValue === "single") {
      if (this.selectedItems[0] === element) this.clear();
      else this.select(element);
      return;
    }
    const previous = this.selectedItems.slice();
    const index = previous.indexOf(element);
    if (index === -1) {
      this.selectedItems.push(element);
      this.paint(element, true);
    } else {
      this.selectedItems.splice(index, 1);
      this.paint(element, false);
      if (this.anchorElement === element) this.anchorElement = this.selectedItems[0] ?? null;
    }
    this.emit(previous);
    if (!this.anchorElement && index === -1) this.anchorElement = element;
  }

  deselect(elementOrIndex: T | number | undefined): void {
    const element = this.resolve(elementOrIndex);
    if (!element) return;
    const index = this.selectedItems.indexOf(element);
    if (index === -1) return;
    const previous = this.selectedItems.slice();
    this.selectedItems.splice(index, 1);
    this.paint(element, false);
    if (this.anchorElement === element) this.anchorElement = this.selectedItems[0] ?? null;
    this.emit(previous);
  }

  selectRange(from: T | number | undefined, to: T | number | undefined): void {
    if (this.modeValue === "none") return;
    const start = this.resolve(from);
    const end = this.resolve(to);
    if (!start || !end) return;
    let a = this.items.indexOf(start);
    let b = this.items.indexOf(end);
    if (a === -1 || b === -1) return;
    if (a > b) {
      const swap = a;
      a = b;
      b = swap;
    }
    const previous = this.selectedItems.slice();
    const next: T[] = [];
    for (let i = a; i <= b; i++) {
      const element = this.items[i];
      if (element) next.push(element);
    }
    this.selectedItems = next;
    this.anchorElement = start;
    for (const element of previous) if (next.indexOf(element) === -1) this.paint(element, false);
    for (const element of next) this.paint(element, true);
    this.emit(previous);
  }

  selectAll(): void {
    if (this.modeValue === "none" || this.modeValue === "single") {
      if (this.modeValue === "single" && this.items[0]) this.select(this.items[0]);
      return;
    }
    const previous = this.selectedItems.slice();
    this.selectedItems = this.items.slice();
    for (const element of this.selectedItems) this.paint(element, true);
    this.anchorElement = this.items[0] ?? null;
    this.emit(previous);
  }

  clear(): void {
    if (this.selectedItems.length === 0 && !this.anchorElement) return;
    const previous = this.selectedItems.slice();
    this.selectedItems = [];
    this.anchorElement = null;
    for (const element of previous) this.paint(element, false);
    this.emit(previous);
  }

  isSelected(elementOrIndex: T | number | undefined): boolean {
    const element = this.resolve(elementOrIndex);
    return element !== null && this.selectedItems.indexOf(element) !== -1;
  }

  indexOfSelected(element: T): number {
    return this.selectedItems.indexOf(element);
  }

  setMode(mode: SelectionMode): void {
    if (mode === this.modeValue) return;
    this.modeValue = mode;
    if (mode === "single" && this.selectedItems.length > 1) {
      const previous = this.selectedItems.slice();
      this.selectedItems = previous.slice(0, 1);
      for (const element of previous) if (this.selectedItems.indexOf(element) === -1) this.paint(element, false);
      this.emit(previous);
    }
    if (mode === "none") this.clear();
  }

  dispose(): void {
    this.provider = null;
    for (const element of this.touched) {
      if (this.aria) setAttribute(element, "aria-selected", null);
      if (this.attribute) element.removeAttribute(this.attribute);
      toggleClass(element, this.selectedClass, false);
    }
    this.touched.clear();
    this.selectedItems = [];
    this.anchorElement = null;
    this.itemsValue = [];
  }

  private resolve(elementOrIndex: T | number | undefined): T | null {
    if (elementOrIndex === undefined || elementOrIndex === null) return null;
    if (typeof elementOrIndex === "number") return this.items[elementOrIndex] ?? null;
    return elementOrIndex;
  }

  private paint(element: T, on: boolean): void {
    this.touched.add(element);
    if (this.aria) setAttribute(element, "aria-selected", on ? "true" : "false");
    if (this.attribute) setAttribute(element, this.attribute, on ? "true" : null);
    toggleClass(element, this.selectedClass, on);
  }

  private emit(previous: readonly T[]): void {
    const added = this.selectedItems.filter((element) => previous.indexOf(element) === -1);
    const removed = previous.filter((element) => this.selectedItems.indexOf(element) === -1);
    if (added.length === 0 && removed.length === 0) return;
    this.options.onChange?.(this.selectedItems);
    this.onDiff?.(this.selectedItems, added, removed);
  }
}

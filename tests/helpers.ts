import type { KeyBinding, KeyMap } from "../src/types/index.js";

export interface Rect {
  readonly top: number;
  readonly left: number;
  readonly width?: number;
  readonly height?: number;
}

export interface KeyOptions {
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  repeat?: boolean;
  code?: string;
  bubbles?: boolean;
  cancelable?: boolean;
}

let counter = 0;

export function makeList(
  count: number,
  options: {
    containerId?: string;
    tag?: string;
    itemSelectorAttribute?: string;
    prefix?: string;
    disabled?: readonly number[];
    hidden?: readonly number[];
    labels?: readonly string[];
  } = {},
): { container: HTMLElement; items: HTMLElement[] } {
  const {
    containerId = "group",
    tag = "button",
    prefix = "item",
    disabled = [],
    hidden = [],
    labels,
  } = options;

  const container = document.createElement("div");
  container.id = containerId;
  document.body.appendChild(container);

  const items: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const element = document.createElement(tag);
    element.textContent = labels?.[i] ?? `${prefix}-${i}`;
    element.dataset.keystraItem = "";
    if (disabled.includes(i)) element.setAttribute("disabled", "");
    if (hidden.includes(i)) element.setAttribute("hidden", "");
    container.appendChild(element);
    items.push(element);
  }
  return { container, items };
}

export function stubLayout(
  elements: readonly Element[],
  layout: (index: number, element: Element) => Rect,
): void {
  elements.forEach((element, index) => {
    const rect = layout(index, element);
    const width = rect.width ?? 20;
    const height = rect.height ?? 20;
    const value = {
      x: rect.left,
      y: rect.top,
      width,
      height,
      top: rect.top,
      left: rect.left,
      right: rect.left + width,
      bottom: rect.top + height,
      toJSON: () => ({}),
    } as DOMRect;
    (element as HTMLElement).getBoundingClientRect = () => value;
  });
}

export function stubGridLayout(elements: readonly Element[], columns: number, cell = 24): void {
  stubLayout(elements, (index) => ({
    left: (index % columns) * cell,
    top: Math.floor(index / columns) * cell,
    width: cell,
    height: cell,
  }));
}

export function stubColumnLayout(elements: readonly Element[], cell = 24): void {
  stubLayout(elements, (index) => ({ left: 0, top: index * cell, width: cell, height: cell }));
}

export function press(key: string, options: KeyOptions & { target?: EventTarget } = {}): KeyboardEvent {
  const { target, bubbles = true, cancelable = true, code, ...rest } = options;
  counter += 1;
  const event = new KeyboardEvent("keydown", {
    key,
    code: code ?? defaultCode(key),
    bubbles,
    cancelable,
    ...rest,
  });
  const active = document.activeElement;
  const origin =
    target ?? (active && active !== document.documentElement ? active : document.body);
  origin.dispatchEvent(event);
  return event;
}

export function pressed(key: string, options: KeyOptions & { target?: EventTarget } = {}): boolean {
  return !press(key, options).defaultPrevented;
}

function defaultCode(key: string): string {
  if (key.length === 1) {
    const upper = key.toUpperCase();
    if (upper >= "A" && upper <= "Z") return `Key${upper}`;
    if (key >= "0" && key <= "9") return `Digit${key}`;
  }
  switch (key) {
    case " ":
      return "Space";
    case "Escape":
      return "Escape";
    case "Enter":
      return "Enter";
    case "Tab":
      return "Tab";
    default:
      return key;
  }
}

export async function tick(times = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function uid(prefix = "el"): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function resetDom(): void {
  document.body.innerHTML = "";
  counter = 0;
}

export type { KeyBinding, KeyMap };

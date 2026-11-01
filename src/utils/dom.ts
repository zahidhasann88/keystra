import type { ElementTarget, ItemSelector } from "../types/index.js";

export function hasDom(): boolean {
  return typeof globalThis !== "undefined" && typeof (globalThis as { document?: unknown }).document !== "undefined";
}

export function resolveElement<T extends Element = Element>(
  target: ElementTarget<T> | EventTarget | null | undefined,
  root: ParentNode | null = null,
): T | null {
  if (target == null) return null;
  if (typeof target === "function") {
    return resolveElement<T>((target as () => ElementTarget<T>)(), root);
  }
  if (typeof target === "string") {
    const scope: ParentNode | null = root ?? (hasDom() ? document : null);
    if (!scope) return null;
    try {
      return scope.querySelector<T>(target);
    } catch {
      return null;
    }
  }
  return target as T;
}

export function queryItems<T extends Element = Element>(
  container: Element | null,
  selector: ItemSelector<T>,
): T[] {
  if (!container) return [];
  if (typeof selector === "function") {
    const result = selector(container);
    return Array.from(result as ArrayLike<T>);
  }
  if (!selector) return [];
  try {
    return Array.from(container.querySelectorAll<T>(selector));
  } catch {
    return [];
  }
}

const DISABLED_SELECTOR_DEFAULT = "[disabled],[aria-disabled='true']";

export function isDisabled(element: Element, selector: string | null = DISABLED_SELECTOR_DEFAULT): boolean {
  if (!selector) return false;
  const html = element as Partial<HTMLButtonElement>;
  if (html.disabled === true) return true;
  if (element.getAttribute("aria-disabled") === "true") return true;
  if (selector === DISABLED_SELECTOR_DEFAULT) return element.hasAttribute("disabled");
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

export function isHidden(element: Element): boolean {
  const html = element as HTMLElement;

  const probe = html as unknown as { checkVisibility?: (options?: Record<string, boolean>) => boolean };
  if (typeof probe.checkVisibility === "function") {
    try {
      return !probe.checkVisibility.call(html, { checkOpacity: false, checkVisibilityCSS: true });
    } catch {
    }
  }

  let node: HTMLElement | null = html;
  while (node && node.nodeType === 1) {
    if (node.hidden === true) return true;
    if (node.style && node.style.display === "none") return true;
    node = node.parentElement;
  }
  return false;
}

export function isFocusable(element: Element): boolean {
  const html = element as HTMLElement;
  if (typeof html.focus !== "function") return false;
  if (isDisabled(element)) return false;
  return !isHidden(element);
}

const EDITABLE_SELECTOR_DEFAULT =
  "input:not([type='hidden']):not([readonly]),textarea:not([readonly]),select,[contenteditable=''],[contenteditable='true'],[iscontenteditable]";

export function isEditableTarget(target: EventTarget | null, extraSelector?: string | null): boolean {
  if (!target || typeof (target as Element).matches !== "function") return false;
  const element = target as Element;
  const selector = extraSelector ? `${EDITABLE_SELECTOR_DEFAULT},${extraSelector}` : EDITABLE_SELECTOR_DEFAULT;
  try {
    if (element.matches(selector)) return true;
  } catch {
  }
  const html = element as HTMLElement;
  return html.isContentEditable === true;
}

export function getText(element: Element): string {
  const label =
    element.getAttribute("aria-label") ??
    (element as HTMLElement).textContent ??
    "";
  return label.replace(/\s+/g, " ").trim();
}

export function setAttribute(element: Element, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

export function toggleClass(element: Element, name: string | undefined, on: boolean): void {
  if (!name) return;
  const html = element as HTMLElement;
  if (typeof html.classList?.toggle === "function") html.classList.toggle(name, on);
}

export function focusElement(element: HTMLElement, preventScroll = true): boolean {
  if (typeof element.focus !== "function") return false;
  try {
    element.focus({ preventScroll });
  } catch {
    try {
      element.focus();
    } catch {
      return false;
    }
  }
  return true;
}

export function contains(parent: Node | null | undefined, child: Node | null | undefined): boolean {
  if (!parent || !child) return false;
  if (parent === child) return true;
  if (typeof parent.contains === "function") return parent.contains(child);
  let node: Node | null = child;
  while (node) {
    if (node === parent) return true;
    node = node.parentNode;
  }
  return false;
}

export function resolveEventTarget(
  target: EventTarget | string | null | (() => EventTarget | string | null | undefined) | undefined,
): EventTarget | null {
  if (target == null) return null;
  if (typeof target === "string") return resolveElement(target);
  if (typeof target === "function") return resolveEventTarget(target());
  return target;
}

let idCounter = 0;

export function ensureId(element: Element, prefix: string): string {
  const existing = element.id;
  if (existing) return existing;
  idCounter += 1;
  const generated = `${prefix}-${idCounter}`;
  element.id = generated;
  return generated;
}

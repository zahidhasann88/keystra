import { ensureId, setAttribute } from "../utils/dom.js";

export { ensureId };

const LANDMARKS = new Set(["NAV", "MAIN", "ASIDE", "HEADER", "FOOTER", "FORM", "SECTION", "ARTICLE", "DIALOG"]);

export function acceptsRole(element: Element): boolean {
  return !element.hasAttribute("role") && !LANDMARKS.has(element.tagName);
}

export function ensureRole(element: Element, role: string, enabled: boolean): void {
  if (enabled && acceptsRole(element)) element.setAttribute("role", role);
}

export function ensureItemRoles(
  container: Element | null,
  items: readonly Element[],
  containerRole: string,
  itemRole: string,
  enabled: boolean,
): void {
  if (!enabled || !container) return;
  if (container.getAttribute("role") !== containerRole) return;
  for (let i = 0; i < items.length; i++) ensureRole(items[i]!, itemRole, true);
}

export function setAria(element: Element | null | undefined, name: string, value: string | null, enabled: boolean): void {
  if (!enabled || !element) return;
  setAttribute(element, name, value);
}

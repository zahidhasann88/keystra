import type { DropdownInstance, DropdownOptions, KeyBinding } from "../types/index.js";
import { MenuController } from "./menu.js";
import { EventManager } from "../core/event-manager.js";
import { KeyMatcher } from "../core/key-matcher.js";
import { normalizeKeyEvent } from "../core/keyboard.js";
import { contains, focusElement, resolveElement } from "../utils/dom.js";
import { ensureId, setAria } from "./shared.js";

const DEFAULT_OPEN_KEYS: readonly KeyBinding[] = ["Enter", "Space", "ArrowDown", "ArrowUp"];

export class DropdownController<T extends HTMLElement = HTMLElement>
  extends MenuController<T>
  implements DropdownInstance<T>
{
  private readonly triggerElement: HTMLElement | null;
  private readonly extra = new EventManager();
  private readonly openMatcher: KeyMatcher;
  private readonly manageTriggerAria: boolean;
  private readonly closeOnBlurValue: boolean;
  private readonly closeOnOutsidePointerValue: boolean;
  private readonly menuId: string | null;

  constructor(options: DropdownOptions<T>) {
    super({ typeahead: true, ...options });

    const doc = this.container?.ownerDocument ?? (typeof document !== "undefined" ? document : null);
    this.triggerElement = resolveElement<HTMLElement>(options.trigger, doc);
    this.manageTriggerAria = options.aria !== false;
    this.closeOnBlurValue = options.closeOnBlur === true;
    this.closeOnOutsidePointerValue = options.closeOnOutsidePointer !== false;

    const openKeys =
      options.openKeys === undefined || options.openKeys === null
        ? DEFAULT_OPEN_KEYS
        : Array.isArray(options.openKeys)
          ? options.openKeys
          : [options.openKeys];
    this.openMatcher = new KeyMatcher({ open: openKeys });

    this.menuId = this.container ? ensureId(this.container, "keystra-menu") : null;
    this.decorateTrigger();
    this.wireTrigger();

    this.on("action", ({ action, event }) => {
      if (action !== "escape") return;
      event?.preventDefault();
      this.close();
    });
  }

  get trigger(): HTMLElement | null {
    return this.triggerElement;
  }

  override open(options: { focus?: "first" | "last" | "current" | number } = {}): void {
    const wasOpen = this.isOpen;
    super.open(options);
    if (!wasOpen && this.isOpen) this.syncTriggerState();
  }

  override close(options: { restoreFocus?: boolean } = {}): void {
    const wasOpen = this.isOpen;
    super.close({ restoreFocus: false });
    if (wasOpen && options.restoreFocus !== false && this.triggerElement) {
      focusElement(this.triggerElement);
    }
    if (wasOpen) this.syncTriggerState();
  }

  override destroy(): void {
    this.extra.dispose();
    this.openMatcher.dispose();
    if (this.triggerElement && this.manageTriggerAria) {
      this.triggerElement.removeAttribute("aria-expanded");
      if (this.menuId) this.triggerElement.removeAttribute("aria-controls");
    }
    super.destroy();
  }

  private decorateTrigger(): void {
    const trigger = this.triggerElement;
    if (!trigger || !this.manageTriggerAria) return;
    if (!trigger.hasAttribute("aria-haspopup")) trigger.setAttribute("aria-haspopup", "menu");
    setAria(trigger, "aria-controls", this.menuId, true);
    this.syncTriggerState();
  }

  private syncTriggerState(): void {
    if (!this.triggerElement || !this.manageTriggerAria) return;
    this.triggerElement.setAttribute("aria-expanded", this.isOpen ? "true" : "false");
  }

  private wireTrigger(): void {
    const trigger = this.triggerElement;
    if (!trigger) return;

    this.extra.add(trigger, "click", () => {
      this.toggle();
    });

    this.extra.add(trigger, "keydown", (rawEvent) => {
      const event = rawEvent as KeyboardEvent;
      if (this.isOpen) {
        if (event.key === "Tab") this.close({ restoreFocus: false });
        return;
      }
      const normalized = normalizeKeyEvent(event);
      const match = this.openMatcher.match(normalized, this);
      if (!match?.complete) return;
      event.preventDefault();
      this.open({ focus: normalized.key === "ArrowUp" ? "last" : "first" });
    });

    if (typeof document !== "undefined") {
      this.extra.add(document, "keydown", (rawEvent) => {
        const event = rawEvent as KeyboardEvent;
        if (event.key !== "Tab" || event.defaultPrevented || !this.isOpen) return;
        if (contains(this.container, event.target as Node | null)) this.close();
      });
    }

    if (this.closeOnOutsidePointerValue && typeof document !== "undefined") {
      this.extra.add(document, "pointerdown", (rawEvent) => {
        if (!this.isOpen) return;
        const target = (rawEvent as PointerEvent).target as Node | null;
        if (contains(this.container, target) || contains(this.triggerElement, target)) return;
        this.close({ restoreFocus: false });
      });
    }

    if (this.closeOnBlurValue && typeof document !== "undefined") {
      this.extra.add(document, "focusin", (rawEvent) => {
        if (!this.isOpen) return;
        const target = (rawEvent as FocusEvent).target as Node | null;
        if (contains(this.container, target) || contains(this.triggerElement, target)) return;
        this.close({ restoreFocus: false });
      });
    }
  }
}

export function createDropdown<T extends HTMLElement = HTMLElement>(
  options: DropdownOptions<T> = {},
): DropdownInstance<T> {
  return new DropdownController<T>(options);
}

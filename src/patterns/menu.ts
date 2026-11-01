import type { KeyAction, MenuInstance, MenuOptions } from "../types/index.js";
import { NavigationController } from "../core/engine.js";
import { MENU_KEYS } from "../core/default-keys.js";
import { focusElement, resolveElement } from "../utils/dom.js";
import { ensureItemRoles, ensureRole } from "./shared.js";

export class MenuController<T extends HTMLElement = HTMLElement>
  extends NavigationController<T>
  implements MenuInstance<T>
{
  private openValue = false;
  private readonly closeOnSelect: boolean;
  private readonly returnFocusTarget: MenuOptions<T>["returnFocusTo"];
  private readonly manageAria: boolean;
  private readonly toggleHiddenValue: boolean;
  private unhidden = false;
  private readonly userOnOpen: MenuOptions<T>["onOpen"];
  private readonly userOnClose: MenuOptions<T>["onClose"];

  constructor(options: MenuOptions<T>) {
    super(
      {
        typeahead: true,
        ...options,
        enabled: false,
      },
      {
        mode: options.mode ?? "vertical",
        loop: options.loop ?? true,
        defaultKeys: MENU_KEYS,
      },
    );

    this.closeOnSelect = options.closeOnSelect !== false;
    this.returnFocusTarget = options.returnFocusTo;
    this.manageAria = options.aria !== false;
    this.toggleHiddenValue = options.toggleHidden !== false;
    this.userOnOpen = options.onOpen;
    this.userOnClose = options.onClose;

    if (this.manageAria && this.container) ensureRole(this.container, "menu", true);
    this.decorateItems();

    this.on("select", () => {
      if (this.closeOnSelect) this.close();
    });

    this.on("action", ({ action }) => {
      if (action === "escape") this.close();
    });

    this.on("refresh", () => this.decorateItems());
  }

  protected decorateItems(): void {
    ensureItemRoles(this.container, this.items, "menu", "menuitem", this.manageAria);
  }

  get isOpen(): boolean {
    return this.openValue;
  }

  open(options: { focus?: "first" | "last" | "current" | number } = {}): void {
    if (this.openValue) return;
    this.openValue = true;
    this.enable();
    this.rememberFocus();
    if (this.toggleHiddenValue && this.container?.hasAttribute("hidden")) {
      this.container.removeAttribute("hidden");
      this.unhidden = true;
    }
    this.refresh();

    if (this.manageAria && this.container) this.container.setAttribute("data-keystra-open", "true");

    const target = options.focus ?? "first";
    const items = this.items;
    if (items.length === 0) {
      this.userOnOpen?.(this);
      return;
    }

    if (target === "current" && this.currentIndex >= 0) {
      this.focusIndex(this.currentIndex);
    } else if (target === "last") {
      this.focusIndex(items.length - 1);
    } else if (typeof target === "number") {
      this.focusIndex(Math.max(0, Math.min(target, items.length - 1)));
    } else {
      this.focusIndex(0);
    }
    this.userOnOpen?.(this);
  }

  close(options: { restoreFocus?: boolean } = {}): void {
    if (!this.openValue) return;
    this.openValue = false;
    this.disable();
    if (this.manageAria && this.container) this.container.removeAttribute("data-keystra-open");

    if (options.restoreFocus !== false) {
      const explicit = resolveElement<HTMLElement>(this.returnFocusTarget, this.container?.ownerDocument ?? null);
      if (explicit) focusElement(explicit);
      else this.restoreFocus();
    }
    if (this.unhidden) {
      this.container?.setAttribute("hidden", "");
      this.unhidden = false;
    }
    this.userOnClose?.(this);
  }

  toggle(): void {
    if (this.openValue) this.close();
    else this.open();
  }

  override destroy(): void {
    this.openValue = false;
    super.destroy();
  }

  protected override ownsAction(action: KeyAction): boolean {
    return action === "select" || action === "escape";
  }
}

export function createMenu<T extends HTMLElement = HTMLElement>(options: MenuOptions<T> = {}): MenuInstance<T> {
  return new MenuController<T>(options);
}

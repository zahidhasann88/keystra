import type { CommandPaletteInstance, CommandPaletteOptions, KeyAction } from "../types/index.js";
import { NavigationController } from "../core/engine.js";
import { COMMAND_PALETTE_KEYS } from "../core/default-keys.js";
import { EventManager } from "../core/event-manager.js";
import { KeyMatcher, type MatchResult } from "../core/key-matcher.js";
import { normalizeKeyEvent } from "../core/keyboard.js";
import { focusElement, resolveElement } from "../utils/dom.js";
import { ensureId, ensureItemRoles, ensureRole, setAria } from "./shared.js";

class CommandPaletteController<T extends HTMLElement = HTMLElement>
  extends NavigationController<T>
  implements CommandPaletteInstance<T>
{
  private readonly inputElement: HTMLInputElement | HTMLTextAreaElement | null;
  private readonly extra = new EventManager();
  private readonly openMatcher: KeyMatcher | null;
  private readonly userOnQuery: CommandPaletteOptions<T>["onQuery"];
  private readonly userOnSubmit: CommandPaletteOptions<T>["onSubmit"];
  private readonly userOnCancel: CommandPaletteOptions<T>["onCancel"];
  private readonly manageAria: boolean;
  private readonly toggleHiddenValue: boolean;
  private openValue = false;
  private listId: string | null = null;
  private listElement: Element | null = null;

  constructor(options: CommandPaletteOptions<T>) {
    const doc = typeof document !== "undefined" ? document : null;
    const containerElement = resolveElement<Element>(options.container, doc);
    const input =
      resolveElement<HTMLInputElement | HTMLTextAreaElement>(options.input, doc) ??
      containerElement?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        "input:not([type='hidden']), textarea",
      ) ??
      null;

    super(
      {
        activeDescendant: input ?? true,
        ...options,
      },
      {
        mode: options.mode ?? "vertical",
        loop: options.loop ?? true,
        defaultKeys: COMMAND_PALETTE_KEYS,
        listenTarget: input ?? containerElement ?? doc,
      },
    );

    this.inputElement = input;
    this.manageAria = options.aria !== false;
    this.toggleHiddenValue = options.toggleHidden !== false;
    this.userOnQuery = options.onQuery;
    this.userOnSubmit = options.onSubmit;
    this.userOnCancel = options.onCancel;

    if (options.openKeys && typeof document !== "undefined") {
      const bindings = Array.isArray(options.openKeys) ? options.openKeys : [options.openKeys];
      this.openMatcher = new KeyMatcher({ open: bindings });
      this.extra.add(document, "keydown", (rawEvent) => {
        const event = rawEvent as KeyboardEvent;
        const match = this.openMatcher!.match(normalizeKeyEvent(event), this);
        if (!match?.complete) return;
        event.preventDefault();
        this.toggle();
      });
    } else {
      this.openMatcher = null;
    }

    this.listElement = resolveElement<Element>(options.list, doc) ?? this.container;
    if (this.manageAria && this.listElement) {
      ensureRole(this.listElement, "listbox", true);
      this.listId = ensureId(this.listElement, "keystra-palette");
    }
    if (this.manageAria && this.inputElement) {
      ensureRole(this.inputElement, "combobox", true);
      setAria(this.inputElement, "aria-controls", this.listId, true);
      setAria(this.inputElement, "aria-expanded", "false", true);
      if (!this.inputElement.hasAttribute("aria-autocomplete")) {
        this.inputElement.setAttribute("aria-autocomplete", "list");
      }
      if (options.placeholder && !this.inputElement.hasAttribute("placeholder")) {
        this.inputElement.setAttribute("placeholder", options.placeholder);
      }
    }

    this.wireInput();
    this.decorateItems();
    this.on("refresh", () => this.decorateItems());

    this.on("select", ({ element }) => {
      this.userOnSubmit?.(element ?? null, this.query);
    });

    this.on("action", ({ action, event }) => {
      if (action !== "escape") return;
      event?.preventDefault();
      this.userOnCancel?.();
      this.close();
    });
  }

  get isOpen(): boolean {
    return this.openValue;
  }

  get query(): string {
    return this.inputElement?.value ?? "";
  }

  get input(): HTMLInputElement | HTMLTextAreaElement | null {
    return this.inputElement;
  }

  open(): void {
    if (this.openValue) return;
    this.openValue = true;
    this.enable();
    this.rememberFocus();
    if (this.container && this.toggleHiddenValue && this.container.hasAttribute("hidden")) {
      this.container.removeAttribute("hidden");
    }
    if (this.inputElement) {
      focusElement(this.inputElement);
      if (typeof this.inputElement.select === "function") this.inputElement.select();
    }
    this.refresh();
    this.setActiveIndex(0, { focus: false });
    setAria(this.inputElement, "aria-expanded", "true", this.manageAria);
  }

  close(options: { restoreFocus?: boolean } = {}): void {
    if (!this.openValue) return;
    this.openValue = false;
    this.disable();
    if (this.container && this.toggleHiddenValue && !this.container.hasAttribute("hidden")) {
      this.container.setAttribute("hidden", "");
    }
    setAria(this.inputElement, "aria-expanded", "false", this.manageAria);
    if (options.restoreFocus !== false) this.restoreFocus();
  }

  toggle(): void {
    if (this.openValue) this.close();
    else this.open();
  }

  setQuery(query: string): void {
    if (!this.inputElement) return;
    if (this.inputElement.value === query) return;
    this.inputElement.value = query;
    this.userOnQuery?.(query);
  }

  override destroy(): void {
    this.extra.dispose();
    this.openMatcher?.dispose();
    if (this.inputElement && this.manageAria) {
      this.inputElement.removeAttribute("aria-expanded");
      if (this.listId) this.inputElement.removeAttribute("aria-controls");
    }
    super.destroy();
  }

  protected override ownsAction(action: KeyAction): boolean {
    return action === "select" || action === "escape";
  }

  protected override runAction(action: KeyAction, event: KeyboardEvent | null, match: MatchResult | null): boolean {
    if (super.runAction(action, event, match)) return true;
    if (action !== "select") return false;
    this.userOnSubmit?.(null, this.query);
    return true;
  }

  private decorateItems(): void {
    ensureItemRoles(this.listElement, this.items, "listbox", "option", this.manageAria);
  }

  private wireInput(): void {
    const input = this.inputElement;
    if (!input) return;

    this.extra.add(input, "input", () => {
      this.userOnQuery?.(input.value);
      this.refresh();
      this.setActiveIndex(0, { focus: false });
    });
  }
}

export function createCommandPalette<T extends HTMLElement = HTMLElement>(
  options: CommandPaletteOptions<T> = {},
): CommandPaletteInstance<T> {
  return new CommandPaletteController<T>(options);
}

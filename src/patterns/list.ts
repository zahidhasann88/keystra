import type { KeystraInstance, ListOptions } from "../types/index.js";
import { NavigationController } from "../core/engine.js";
import { LIST_KEYS } from "../core/default-keys.js";
import { resolveElement } from "../utils/dom.js";
import { acceptsRole, ensureItemRoles, ensureRole, setAria } from "./shared.js";

class ListController<T extends HTMLElement = HTMLElement> extends NavigationController<T> {
  private readonly manageAria: boolean;

  constructor(options: ListOptions<T>) {
    super(options, {
      mode: options.mode ?? "vertical",
      loop: options.loop ?? false,
      defaultKeys: LIST_KEYS,
    });

    this.manageAria = options.aria !== false;
    if (this.manageAria && this.container) {
      ensureRole(this.container, "listbox", true);
      if (this.container.getAttribute("role") === "listbox" && this.selectionManager) {
        const multiple = this.selectionManager.mode === "multiple" || this.selectionManager.mode === "range";
        setAria(this.container, "aria-multiselectable", multiple ? "true" : null, true);
      }
    }
    this.decorateItems();
    this.on("refresh", () => this.decorateItems());
  }

  private decorateItems(): void {
    ensureItemRoles(this.container, this.items, "listbox", "option", this.manageAria);
  }
}

export function createList<T extends HTMLElement = HTMLElement>(
  options: ListOptions<T> = {},
): KeystraInstance<T> {
  const container = resolveElement<Element>(options.container);
  const aria =
    options.aria !== false &&
    container !== null &&
    (container.getAttribute("role") === "listbox" || acceptsRole(container));

  const selection = options.selection ?? { enabled: true, mode: "single", followFocus: true };
  return new ListController<T>({
    typeahead: true,
    ...options,
    selection: typeof selection === "object" ? { aria, ...selection } : selection && { mode: "single", aria },
  });
}

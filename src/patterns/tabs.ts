import type { KeyAction, TabsInstance, TabsOptions } from "../types/index.js";
import { NavigationController } from "../core/engine.js";
import { TABS_KEYS_HORIZONTAL, TABS_KEYS_VERTICAL } from "../core/default-keys.js";
import { queryItems } from "../utils/dom.js";
import { ensureId, ensureRole, setAria } from "./shared.js";

class TabsController<T extends HTMLElement = HTMLElement>
  extends NavigationController<T>
  implements TabsInstance<T>
{
  private readonly orientationValue: "horizontal" | "vertical";
  private readonly activationValue: "automatic" | "manual";
  private readonly manageAria: boolean;
  private readonly activeAttribute: string;
  private readonly panelActiveAttribute: string;
  private readonly panelSelector: TabsOptions<T>["panels"];
  private readonly userOnActivate: TabsOptions<T>["onActivate"];
  private panels: Element[] = [];
  private activeValue = -1;
  private applying = false;
  private initializing = true;

  constructor(options: TabsOptions<T>) {
    const orientation = options.orientation ?? "horizontal";
    super(options, {
      mode: options.mode ?? (orientation === "vertical" ? "vertical" : "horizontal"),
      loop: options.loop ?? true,
      defaultKeys: orientation === "vertical" ? TABS_KEYS_VERTICAL : TABS_KEYS_HORIZONTAL,
    });

    this.orientationValue = orientation;
    this.activationValue = options.activation ?? "automatic";
    this.manageAria = options.aria !== false;
    this.activeAttribute = options.activeAttribute ?? "aria-selected";
    this.panelActiveAttribute = options.panelActiveAttribute ?? "hidden";
    this.panelSelector = options.panels;
    this.userOnActivate = options.onActivate;

    if (this.manageAria && this.container) {
      ensureRole(this.container, "tablist", true);
      if (this.container.getAttribute("role") === "tablist") {
        setAria(this.container, "aria-orientation", this.orientationValue, true);
      }
    }

    this.on("focus", ({ index }) => {
      if (this.activationValue === "automatic") this.activate(index);
    });

    this.on("action", ({ action, index }) => {
      if (this.activationValue === "manual" && action === "select" && index >= 0) this.activate(index);
    });

    this.on("refresh", () => this.refreshPanels());

    this.refreshPanels();
    this.decorate();

    const initial = this.detectInitialIndex();
    this.applyActive(initial);
    this.initializing = false;
  }

  get activeTab(): T | null {
    return this.activeValue >= 0 ? (this.items[this.activeValue] ?? null) : null;
  }

  override get activeIndex(): number {
    return this.activeValue;
  }

  get orientation(): "horizontal" | "vertical" {
    return this.orientationValue;
  }

  get activation(): "automatic" | "manual" {
    return this.activationValue;
  }

  activate(indexOrElement: number | T | null): void {
    if (indexOrElement === null) {
      this.applyActive(-1);
      return;
    }
    const index =
      typeof indexOrElement === "number" ? indexOrElement : this.items.indexOf(indexOrElement);
    if (index < 0 || index >= this.items.length) return;
    this.applyActive(index, true);
  }

  override refresh(): readonly T[] {
    const items = super.refresh();
    this.refreshPanels();
    this.decorate();
    if (this.activeValue >= items.length) this.applyActive(items.length > 0 ? 0 : -1);
    else this.applyActive(this.activeValue);
    return items;
  }

  protected override ownsAction(action: KeyAction): boolean {
    return action === "select";
  }

  private refreshPanels(): void {
    if (!this.panelSelector || !this.container) {
      this.panels = [];
      return;
    }
    let panels = queryItems(this.container, this.panelSelector);
    if (panels.length === 0) {
      const scope = this.container.parentElement;
      if (scope && scope !== this.container.ownerDocument?.documentElement) {
        panels = queryItems(scope, this.panelSelector);
      }
    }
    this.panels = panels;
  }

  private decorate(): void {
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      const tab = items[i]!;
      ensureRole(tab, "tab", this.manageAria);
      if (!this.manageAria) continue;
      const tabId = ensureId(tab, "keystra-tab");
      const panel = this.panels[i];
      if (!panel) continue;
      const panelId = ensureId(panel, "keystra-panel");
      ensureRole(panel, "tabpanel", true);
      setAria(tab, "aria-controls", panelId, true);
      setAria(panel, "aria-labelledby", tabId, true);
    }
  }

  private detectInitialIndex(): number {
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i]!.getAttribute(this.activeAttribute) === "true") return i;
    }
    return items.length > 0 ? 0 : -1;
  }

  private applyActive(index: number, moveFocus = false): void {
    if (this.applying) return;
    this.applying = true;
    try {
      this.applyActiveNow(index, moveFocus);
    } finally {
      this.applying = false;
    }
  }

  private applyActiveNow(index: number, moveFocus: boolean): void {
    const items = this.items;
    const previous = this.activeValue;
    this.activeValue = index;

    const writeMarker = this.manageAria || this.activeAttribute !== "aria-selected";
    const writePanels = this.manageAria;

    for (let i = 0; i < items.length; i++) {
      const tab = items[i]!;
      const on = i === index;
      if (writeMarker && tab.getAttribute(this.activeAttribute) !== (on ? "true" : "false")) {
        tab.setAttribute(this.activeAttribute, on ? "true" : "false");
      }
      if (this.manageAria && this.activeAttribute !== "aria-selected") {
        setAria(tab, "aria-selected", on ? "true" : "false", true);
      }
      if (!writePanels) continue;
      const panel = this.panels[i];
      if (!panel) continue;
      if (this.panelActiveAttribute === "hidden") {
        if (panel.hasAttribute("hidden") === on) panel.toggleAttribute("hidden", !on);
      } else {
        panel.setAttribute(this.panelActiveAttribute, on ? "true" : "false");
      }
    }

    if (index >= 0) {
      if (moveFocus && items[index] !== this.activeElement) this.focusIndex(index);
      else if (!moveFocus) this.setActiveIndex(index, { focus: false });
    }

    if (previous !== index && index >= 0 && !this.initializing) {
      const element = items[index];
      if (element) this.userOnActivate?.(element, index);
    }
  }
}

export function createTabs<T extends HTMLElement = HTMLElement>(options: TabsOptions<T> = {}): TabsInstance<T> {
  return new TabsController<T>(options);
}

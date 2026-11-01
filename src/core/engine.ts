import type {
  AutoFocusOptions,
  Direction,
  EventName,
  EventHandler,
  ItemSelector,
  KeyAction,
  KeyMap,
  KeystraInstance,
  KeystraOptions,
  NavigationMode,
  NavigationStrategy,
  NavigationStrategyContext,
  RovingOptions,
  SelectionController,
  SelectionOptions,
  TypeaheadOptions,
  Unsubscribe,
  ElementTarget,
} from "../types/index.js";
import { FocusManager } from "../focus/focus-manager.js";
import { SelectionManager } from "../selection/selection-manager.js";
import { createDirectionalStrategy } from "../navigation/directional.js";
import { createGridStrategy } from "../navigation/grid.js";
import { createSequentialStrategy } from "../navigation/sequential.js";
import { contains, isEditableTarget, resolveElement, resolveEventTarget } from "../utils/dom.js";
import { Emitter } from "../utils/emitter.js";
import { defaultKeysFor, mergeKeys } from "./default-keys.js";
import { EventManager } from "./event-manager.js";
import { ItemCollection, createRectOf } from "./item-collection.js";
import { KeyMatcher, type MatchResult } from "./key-matcher.js";
import { isModifierKey, normalizeKeyEvent } from "./keyboard.js";
import type { NormalizedKeyEvent } from "../types/index.js";
import { createTypeahead, type TypeaheadController } from "./typeahead.js";

const DEFAULT_ITEM_SELECTOR = "[data-keystra-item]";
const DEFAULT_DISABLED_SELECTOR = "[disabled],[aria-disabled='true']";
const DEFAULT_PAGE_SIZE = 10;

const MOVEMENT_ACTIONS: ReadonlySet<string> = new Set([
  "next",
  "previous",
  "up",
  "down",
  "left",
  "right",
  "first",
  "last",
  "pageUp",
  "pageDown",
]);

export interface ResolvedOptions<T extends Element> {
  container: Element | null;
  listenTarget: EventTarget | null;
  pinnedTarget: boolean;
  selector: ItemSelector<T>;
  disabledSelector: string | null;
  skipHidden: boolean;
  filter: ((element: T, index: number) => boolean) | null;
  mode: NavigationMode;
  loop: boolean;
  columns: number;
  pageSize: number;
  strategy: NavigationStrategy<T>;
  userStrategy: NavigationStrategy<T> | null;
  onBeforeNavigate: NavigationStrategy<T> | null;
  keys: KeyMap;
  defaultKeys: KeyMap | null;
  userKeys: KeyMap | null;
  useDefaultKeys: boolean;
  sequences: KeystraOptions<T>["sequences"];
  typeahead: (TypeaheadOptions<T> & { enabled: true }) | null;
  roving: RovingOptions;
  activeDescendant: boolean;
  descendantOwner: (() => Element | null) | null;
  autoFocus: AutoFocusOptions<T>;
  selectionOptions: SelectionOptions<T> | null;
  observe: boolean | MutationObserverInit;
  onlyWhenFocusedInside: boolean;
  when: (() => boolean) | null;
  ignoreEditable: boolean;
  editableSelector: string | null;
  stopPropagation: boolean;
  preventDefault: boolean;
  capture: boolean;
  pointerSync: boolean;
  handlers: {
    onFocus?: (element: T, index: number) => void;
    onBlur?: (element: T, index: number) => void;
    onSelect?: (element: T, index: number) => void;
    onAction?: (action: KeyAction, event: KeyboardEvent | null, element: T | null, index: number) => void;
    onEscape?: (event: KeyboardEvent | null) => void;
    onRefresh?: (items: readonly T[]) => void;
  };
}

export function resolveOptions<T extends Element = HTMLElement>(
  options: KeystraOptions<T> = {},
  overrides: Partial<ResolvedOptions<T>> = {},
): ResolvedOptions<T> {
  const mode = overrides.mode ?? options.mode ?? "vertical";
  const container = overrides.container ?? resolveElement(options.container) ?? null;
  const keys =
    overrides.keys ??
    mergeKeys(
      overrides.defaultKeys ?? defaultKeysFor(mode),
      options.keys,
      options.useDefaultKeys !== false,
    );
  const userStrategy = options.strategy ?? null;

  const listenTarget: EventTarget | null =
    overrides.listenTarget ??
    resolveEventTarget(options.target) ??
    container ??
    (typeof document !== "undefined" ? document : null);

  const resolved: ResolvedOptions<T> = {
    container,
    pinnedTarget: options.target !== undefined && options.target !== null,
    listenTarget,
    selector: (options.items ?? options.itemSelector ?? DEFAULT_ITEM_SELECTOR) as ItemSelector<T>,
    disabledSelector:
      options.disabledSelector === false || options.disabledSelector === null
        ? null
        : (options.disabledSelector as string | undefined) ?? DEFAULT_DISABLED_SELECTOR,
    skipHidden: options.skipHidden !== false,
    filter: options.filter ?? null,
    mode,
    loop: overrides.loop ?? options.loop === true,
    columns: overrides.columns ?? options.columns ?? 0,
    pageSize: options.pageSize ?? DEFAULT_PAGE_SIZE,
    strategy: userStrategy ?? overrides.strategy ?? strategyForMode<T>(mode),
    userStrategy,
    onBeforeNavigate: options.onBeforeNavigate ?? null,
    keys,
    defaultKeys: overrides.defaultKeys ?? null,
    userKeys: options.keys ?? null,
    useDefaultKeys: options.useDefaultKeys !== false,
    sequences: options.sequences ?? [],
    typeahead: normalizeTypeahead(options.typeahead),
    roving: normalizeRoving(options.roving),
    activeDescendant: options.activeDescendant === true || (options.activeDescendant !== undefined && options.activeDescendant !== false && options.activeDescendant !== null),
    descendantOwner: options.activeDescendant === undefined || options.activeDescendant === false || options.activeDescendant === null
      ? null
      : options.activeDescendant === true
        ? () => resolveActiveDescendantOwner(container, listenTarget)
        : () => resolveElement<HTMLElement>(options.activeDescendant as ElementTarget<HTMLElement>, container?.ownerDocument ?? null),
    autoFocus: normalizeAutoFocus(options.autoFocus),
    selectionOptions: normalizeSelection(options.selection),
    observe: options.observe ?? false,
    onlyWhenFocusedInside: options.onlyWhenFocusedInside !== false,
    when: options.when ?? null,
    ignoreEditable: options.ignoreEditable !== false,
    editableSelector: options.editableSelector ?? null,
    stopPropagation: options.stopPropagation !== false,
    preventDefault: options.preventDefault !== false,
    capture: options.capture === true,
    pointerSync: options.pointerSync === true,
    handlers: {
      onFocus: options.onFocus,
      onBlur: options.onBlur,
      onSelect: options.onSelect,
      onAction: options.onAction,
      onEscape: options.onEscape,
      onRefresh: options.onRefresh,
    },
  };

  return resolved;
}

function strategyForMode<T extends Element>(mode: NavigationMode): NavigationStrategy<T> {
  switch (mode) {
    case "horizontal":
      return createSequentialStrategy<T>("horizontal");
    case "grid":
      return createGridStrategy<T>();
    case "directional":
      return createDirectionalStrategy<T>();
    case "custom":
      return () => null;
    case "sequential":
    case "vertical":
    default:
      return createSequentialStrategy<T>("vertical");
  }
}

function normalizeTypeahead<T extends Element>(
  input: KeystraOptions<T>["typeahead"],
): (TypeaheadOptions<T> & { enabled: true }) | null {
  if (!input) return null;
  if (input === true) return { enabled: true };
  return input.enabled === false ? null : { ...input, enabled: true };
}

function resolveActiveDescendantOwner(container: Element | null, listenTarget: EventTarget | null): Element | null {
  if (listenTarget && typeof (listenTarget as Element).nodeType === "number") {
    const element = listenTarget as Element;
    if (!container || contains(container, element) || element === container) return element;
  }
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  if (active && container && contains(container, active)) return active;
  return null;
}

function normalizeRoving(input: KeystraOptions["roving"]): RovingOptions {
  if (input === false) return { enabled: false };
  if (input === true || input === undefined) return { enabled: true };
  return input;
}

function normalizeAutoFocus<T extends Element>(input: KeystraOptions<T>["autoFocus"]): AutoFocusOptions<T> {
  if (!input) return { enabled: false };
  if (input === true) return { enabled: true };
  return input;
}

function normalizeSelection<T extends Element>(input: KeystraOptions<T>["selection"]): SelectionOptions<T> | null {
  if (!input) return null;
  if (input === true) return { enabled: true, mode: "single" };
  return input.enabled === false ? null : { enabled: true, ...input };
}

export class NavigationController<T extends Element = HTMLElement> implements KeystraInstance<T> {
  protected resolved: ResolvedOptions<T>;
  protected readonly collection: ItemCollection<T>;
  protected readonly focus: FocusManager<T>;
  protected readonly events = new EventManager();
  protected readonly emitter = new Emitter<T>();
  protected readonly matcher: KeyMatcher;
  protected typeaheadController: TypeaheadController<T> | null;
  protected selectionManager: SelectionManager<T> | null;
  protected keydownDisposer: (() => void) | null = null;
  protected auxDisposers: (() => void)[] = [];
  protected syncPending = true;
  protected destroyed = false;

  constructor(options: KeystraOptions<T> = {}, overrides: Partial<ResolvedOptions<T>> = {}) {
    this.resolved = resolveOptions<T>(options, overrides);

    this.collection = new ItemCollection<T>(
      this.resolved.container,
      {
        selector: this.resolved.selector,
        disabledSelector: this.resolved.disabledSelector,
        skipHidden: this.resolved.skipHidden,
        filter: this.resolved.filter,
        observe: this.resolved.observe,
      },
      () => {
        this.syncPending = true;
      },
    );

    this.focus = new FocusManager<T>({
      roving: this.resolved.roving,
      virtual: this.resolved.activeDescendant,
      descendantOwner: this.resolved.descendantOwner,
      disabledSelector: this.resolved.disabledSelector,
      skipHidden: this.resolved.skipHidden,
      onFocus: (element, index, action) => {
        const selection = this.resolved.selectionOptions;
        if (selection?.followFocus && selection.mode !== "multiple") {
          this.selectionManager?.select(index);
        }
        this.resolved.handlers.onFocus?.(element, index);
        this.emitter.emit("focus", { element, index, action });
      },
      onBlur: (element, index) => {
        this.resolved.handlers.onBlur?.(element, index);
        this.emitter.emit("blur", { element, index });
      },
    });

    if (options.elements) this.collection.setItems(options.elements);

    this.matcher = new KeyMatcher(this.resolved.keys, this.resolved.sequences ?? []);
    this.typeaheadController = this.resolved.typeahead ? createTypeahead<T>(this.resolved.typeahead) : null;
    this.selectionManager = this.resolved.selectionOptions ? new SelectionManager<T>(this.resolved.selectionOptions) : null;
    this.selectionManager?.setDiffHandler((selected, added, removed) => {
      this.emitter.emit("selectionchange", { selected, added, removed });
    });
    this.selectionManager?.bindItems(() => this.collection.items);

    if (options.enabled !== false) this.attach();
    if (this.resolved.autoFocus.enabled) this.applyAutoFocus();
  }

  get container(): Element | null {
    return this.resolved.container;
  }

  get items(): readonly T[] {
    this.sync();
    return this.collection.items;
  }

  get activeElement(): T | null {
    this.sync();
    return this.focus.element;
  }

  get activeIndex(): number {
    this.sync();
    return this.focus.focusedIndex;
  }

  get currentIndex(): number {
    this.sync();
    return this.focus.index;
  }

  get mode(): NavigationMode {
    return this.resolved.mode;
  }

  get loop(): boolean {
    return this.resolved.loop;
  }

  get enabled(): boolean {
    return this.keydownDisposer !== null;
  }

  get selection(): SelectionController<T> | null {
    this.sync();
    return this.selectionManager;
  }

  next(count = 1): T | null {
    return this.step(count, "next");
  }

  previous(count = 1): T | null {
    return this.step(-count, "previous");
  }

  up(): T | null {
    return this.move("up");
  }

  down(): T | null {
    return this.move("down");
  }

  left(): T | null {
    return this.move("left");
  }

  right(): T | null {
    return this.move("right");
  }

  move(direction: Direction): T | null {
    this.collection.revalidate();
    this.sync();
    const index = this.resolveNavigation(direction, direction, null);
    if (index === null) return null;
    const focused = this.focus.focusIndex(index, direction);
    if (focused) this.afterMove(index, direction, null);
    return focused;
  }

  first(): T | null {
    this.collection.revalidate();
    this.sync();
    if (this.collection.items.length === 0) return null;
    const focused = this.focus.focusIndex(0, "first");
    if (focused) this.afterMove(0, "first", null);
    return focused;
  }

  last(): T | null {
    this.collection.revalidate();
    this.sync();
    const total = this.collection.items.length;
    if (total === 0) return null;
    const focused = this.focus.focusIndex(total - 1, "last");
    if (focused) this.afterMove(total - 1, "last", null);
    return focused;
  }

  focusFirst(): T | null {
    return this.first();
  }

  focusLast(): T | null {
    return this.last();
  }

  pageUp(): T | null {
    return this.step(-this.resolved.pageSize, "pageUp");
  }

  pageDown(): T | null {
    return this.step(this.resolved.pageSize, "pageDown");
  }

  focusIndex(index: number): T | null {
    this.collection.revalidate();
    this.sync();
    return this.focus.focusIndex(index, null);
  }

  setActiveIndex(index: number, options: { focus?: boolean } = {}): T | null {
    this.collection.revalidate();
    this.sync();
    if (options.focus === false) {
      this.focus.setActiveIndex(index);
      return this.collection.items[index] ?? null;
    }
    return this.focus.focusIndex(index, null);
  }

  focusElement(element: T | null | undefined): boolean {
    this.sync();
    return this.focus.focusElement(element ?? null);
  }

  restoreFocus(): boolean {
    return this.focus.restore();
  }

  protected rememberFocus(): void {
    if (typeof document === "undefined") return;
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body || active === document.documentElement) return;
    if (this.resolved.container && contains(this.resolved.container, active)) return;
    this.focus.remember(active);
  }

  select(elementOrIndex?: T | number): void {
    this.sync();
    const index = this.resolveIndex(elementOrIndex);
    const element = index >= 0 ? this.collection.items[index] : undefined;
    if (!element) return;
    this.applySelection(index, false);
    this.resolved.handlers.onSelect?.(element, index);
    this.emitter.emit("select", { element, index });
    this.emitAction("select", null, element, index);
  }

  perform(action: KeyAction, event: KeyboardEvent | null = null): boolean {
    if (this.destroyed) return false;
    return this.runAction(action, event, null);
  }

  setContainer(container: ElementTarget<Element> | null): void {
    const next = resolveElement<Element>(container, this.resolved.container?.ownerDocument ?? null);
    if (next === this.resolved.container) return;

    const attached = this.keydownDisposer !== null;
    if (attached) this.detach();

    this.resolved.container = next;
    if (!this.resolved.pinnedTarget) {
      this.resolved.listenTarget = next ?? (typeof document !== "undefined" ? document : null);
    }
    this.collection.setContainer(next);

    if (attached) this.attach();
    this.syncPending = true;
    this.emitter.emit("refresh", { items: this.collection.items });
  }

  refresh(): readonly T[] {
    const items = this.collection.refresh();
    this.sync(true);
    this.resolved.handlers.onRefresh?.(items);
    this.emitter.emit("refresh", { items });
    return items;
  }

  add(element: T | readonly T[]): void {
    this.collection.add(element);
  }

  remove(element: T | readonly T[]): void {
    this.collection.remove(element);
  }

  setItems(elements: readonly T[] | null): void {
    this.collection.setItems(elements);
  }

  enable(): void {
    if (this.destroyed || this.enabled) return;
    this.attach();
  }

  disable(): void {
    this.detach();
    this.matcher.resetSequence();
    this.typeaheadController?.reset();
  }

  update(
    options: Partial<
      Pick<KeystraOptions<T>, "keys" | "loop" | "mode" | "columns" | "enabled" | "pageSize" | "container">
    >,
  ): void {
    if (this.destroyed) return;

    if (options.container !== undefined) this.setContainer(options.container);

    if (options.mode !== undefined && options.mode !== this.resolved.mode) {
      this.resolved.mode = options.mode;
      if (!this.resolved.userStrategy) {
        this.resolved.strategy = strategyForMode<T>(options.mode);
      }
    }
    if (options.loop !== undefined) this.resolved.loop = options.loop === true;
    if (options.columns !== undefined) this.resolved.columns = options.columns ?? 0;
    if (options.pageSize !== undefined) this.resolved.pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    if (options.keys !== undefined) this.resolved.userKeys = options.keys;
    if (options.keys !== undefined || options.mode !== undefined) {
      this.resolved.keys = mergeKeys(
        this.resolved.defaultKeys ?? defaultKeysFor(this.resolved.mode),
        this.resolved.userKeys,
        this.resolved.useDefaultKeys,
      );
      this.matcher.loadMap(this.resolved.keys);
    }
    if (options.enabled === true) this.enable();
    else if (options.enabled === false) this.disable();
    this.syncPending = true;
  }

  on<E extends EventName>(event: E, handler: EventHandler<E, T>): Unsubscribe {
    return this.emitter.on(event, handler);
  }

  off<E extends EventName>(event: E, handler?: EventHandler<E, T>): void {
    this.emitter.off(event, handler);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.detach();
    this.events.dispose();
    this.collection.dispose();
    this.matcher.dispose();
    this.typeaheadController?.dispose();
    this.typeaheadController = null;
    this.selectionManager?.dispose();
    this.selectionManager = null;
    this.focus.dispose();
    this.emitter.emit("destroy", {});
    this.emitter.clear();
  }

  protected attach(): void {
    const target = this.resolved.listenTarget;
    if (!target || this.keydownDisposer) return;

    const listenerOptions: AddEventListenerOptions = { capture: this.resolved.capture, passive: false };
    this.keydownDisposer = this.events.add(target, "keydown", (event) => this.onKeydown(event as KeyboardEvent), listenerOptions);

    this.auxDisposers.push(
      this.events.add(target, "focusin", (event) => {
        this.focus.observe((event as FocusEvent).target as Element | null, this.resolved.container);
      }),
    );

    if (this.resolved.pointerSync && this.resolved.container) {
      this.auxDisposers.push(
        this.events.add(this.resolved.container, "click", (event) => this.onPointer(event as MouseEvent)),
        this.events.add(this.resolved.container, "pointerover", (event) => this.onPointerOver(event)),
      );
    }

    if (this.resolved.observe) this.collection.startObserving();
  }

  protected detach(): void {
    if (this.keydownDisposer) {
      this.keydownDisposer();
      this.keydownDisposer = null;
    }
    for (const dispose of this.auxDisposers) dispose();
    this.auxDisposers.length = 0;
    this.collection.stopObserving();
  }

  protected applyAutoFocus(): void {
    const { target } = this.resolved.autoFocus;
    this.sync(true);
    const items = this.collection.items;
    if (items.length === 0) return;
    let index = 0;
    if (target === "last") index = items.length - 1;
    else if (typeof target === "function") index = target(items);
    this.focus.focusIndex(clampIndex(index, items.length, false), null);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.destroyed) return;
    if (this.resolved.when && !this.resolved.when()) return;
    this.collection.revalidate();

    const normalized: NormalizedKeyEvent = normalizeKeyEvent(event);
    const match: MatchResult | null = this.matcher.match(normalized, this);

    if (this.reservedTarget(event) && !(match?.complete ?? false)) return;

    if (!match) {
      if (this.handleTypeahead(normalized, event)) return;
      if (!isModifierKey(normalized.key)) this.emitter.emit("keydown", { event, handled: false });
      return;
    }

    if (!match.complete) {
      if (match.preventDefault && this.resolved.preventDefault) event.preventDefault();
      return;
    }

    if (this.reservedTarget(event)) return;
    if (this.resolved.onlyWhenFocusedInside && !this.focusIsInside()) return;

    const actions = match.actions;
    for (let i = 0; i < actions.length; i++) {
      if (this.runAction(actions[i]!, event, match)) {
        if (this.resolved.preventDefault) event.preventDefault();
        if (this.resolved.stopPropagation) event.stopPropagation();
        this.emitter.emit("keydown", { event, handled: true });
        return;
      }
    }
    this.emitter.emit("keydown", { event, handled: false });
  }

  protected reservedTarget(event: KeyboardEvent): boolean {
    if (!this.resolved.ignoreEditable) return false;
    if (event.target === this.resolved.listenTarget) return false;
    return isEditableTarget(event.target, this.resolved.editableSelector);
  }

  protected focusIsInside(): boolean {
    if (typeof document === "undefined") return true;
    const active = document.activeElement;
    const container = this.resolved.container;
    const nothingFocused = !active || active === document.body || active === document.documentElement;

    if (nothingFocused) {
      return this.focus.element !== null || container === null;
    }
    if (!container) return true;
    if (contains(container, active)) return true;
    return this.focus.element !== null && contains(container, this.focus.element);
  }

  protected handleTypeahead(normalized: NormalizedKeyEvent, event: KeyboardEvent): boolean {
    const typeahead = this.typeaheadController;
    if (!typeahead) return false;
    if (!normalized.isPrintable || normalized.key.length !== 1 || normalized.repeat) return false;

    this.sync();
    const items = this.collection.items;
    if (items.length === 0) return false;

    const match = typeahead.handle(normalized.key, items, this.focus.index);
    if (!match) return false;
    const index = items.indexOf(match);
    if (index === -1) return false;

    const focused = this.focus.focusIndex(index, "typeahead");
    if (!focused) return false;
    this.afterMove(index, "typeahead", event);
    if (this.resolved.preventDefault) event.preventDefault();
    if (this.resolved.stopPropagation) event.stopPropagation();
    this.emitter.emit("keydown", { event, handled: true });
    return true;
  }

  protected runAction(action: KeyAction, event: KeyboardEvent | null, match: MatchResult | null): boolean {
    const fromSequence = match?.fromSequence === true;
    this.sync();
    const items = this.collection.items;
    const index = this.focus.index;
    const element = index >= 0 ? (items[index] ?? null) : null;

    if (MOVEMENT_ACTIONS.has(action)) {
      if (items.length === 0) return false;
      return this.runMovement(action, event, items, fromSequence);
    }

    switch (action) {
      case "select": {
        if (index < 0) return false;
        const item = items[index]!;
        if (this.resolved.selectionOptions?.selectOnActivate !== false) this.applySelection(index, false);
        this.resolved.handlers.onSelect?.(item, index);
        this.emitter.emit("select", { element: item, index });
        this.emitAction(action, event, item, index, fromSequence);
        return this.selectionManager !== null || this.isHeard(action) || !activatesNatively(item);
      }

      case "toggle": {
        const mode = this.selectionManager?.mode;
        if (!this.selectionManager || mode === "single" || mode === "none") return false;
        if (index < 0) return false;
        this.selectionManager.toggle(index);
        this.emitAction(action, event, items[index]!, index, fromSequence);
        return true;
      }

      case "selectAll": {
        if (!this.selectionManager) return false;
        this.selectionManager.selectAll();
        this.emitAction(action, event, element, index, fromSequence);
        return true;
      }

      case "escape": {
        this.typeaheadController?.reset();
        this.matcher.resetSequence();
        this.emitAction(action, event, element, index, fromSequence);
        this.resolved.handlers.onEscape?.(event);
        return this.isHeard(action);
      }

      default: {
        this.emitAction(action, event, element, index, fromSequence);
        return true;
      }
    }
  }

  protected runMovement(action: KeyAction, event: KeyboardEvent | null, items: readonly T[], fromSequence = false): boolean {
    const direction: Direction | null =
      action === "up" || action === "down" || action === "left" || action === "right"
        ? (action as Direction)
        : null;

    let target: number;
    switch (action) {
      case "first":
        target = this.resolveNavigation(action, null, event) ?? 0;
        break;
      case "last":
        target = this.resolveNavigation(action, null, event) ?? items.length - 1;
        break;
      case "pageUp":
      case "pageDown": {
        const delta = (action === "pageDown" ? 1 : -1) * this.resolved.pageSize;
        const current = this.focus.index;
        const raw = current < 0 ? (delta > 0 ? 0 : items.length - 1) : current + delta;
        target = clampIndex(raw, items.length, this.resolved.loop);
        break;
      }
      default: {
        const resolved = this.resolveNavigation(action, direction, event);
        if (resolved === null) return false;
        target = resolved;
      }
    }

    const focused = this.focus.focusIndex(target, action);
    if (!focused) return false;
    this.afterMove(target, action, event, fromSequence);
    return true;
  }

  protected isHeard(action: KeyAction): boolean {
    const { onSelect, onEscape, onAction } = this.resolved.handlers;
    if (onAction || this.ownsAction(action)) return true;
    return action === "escape" ? onEscape !== undefined : onSelect !== undefined;
  }

  protected ownsAction(_action: KeyAction): boolean {
    return false;
  }

  protected emitAction(
    action: KeyAction,
    event: KeyboardEvent | null,
    element: T | null,
    index: number,
    fromSequence = false,
  ): void {
    this.resolved.handlers.onAction?.(action, event, element, index);
    this.emitter.emit("action", { action, event, element, index, fromSequence });
  }

  protected afterMove(index: number, action: KeyAction, event: KeyboardEvent | null, fromSequence = false): void {
    this.emitAction(action, event, this.collection.items[index] ?? null, index, fromSequence);
    const selection = this.resolved.selectionOptions;
    if (!selection) return;
    if (!selection.followFocus && selection.mode === "range" && selection.shiftExtendsRange !== false && event?.shiftKey) {
      this.extendRangeTo(index);
    }
  }

  protected resolveNavigation(action: KeyAction, direction: Direction | null, event: KeyboardEvent | null): number | null {
    const items = this.collection.items;
    if (items.length === 0) return null;
    const context = this.createContext(action, direction, event);

    if (this.resolved.onBeforeNavigate) {
      const override = this.resolved.onBeforeNavigate(context);
      if (typeof override === "number" && override >= 0 && override < items.length) return override;
    }

    const result = this.resolved.strategy(context);
    if (typeof result !== "number" || result < 0) return null;
    return result >= items.length ? items.length - 1 : result;
  }

  protected createContext(
    action: KeyAction,
    direction: Direction | null,
    event: KeyboardEvent | null,
  ): NavigationStrategyContext<T> {
    return {
      items: this.collection.items,
      container: this.resolved.container,
      index: this.focus.index,
      direction,
      action,
      event,
      shiftKey: event?.shiftKey === true,
      altKey: event?.altKey === true,
      ctrlKey: event?.ctrlKey === true,
      metaKey: event?.metaKey === true,
      columns: this.resolved.columns,
      loop: this.resolved.loop,
      version: this.collection.version,
      rectOf: createRectOf(this.collection),
    };
  }

  protected step(delta: number, action: KeyAction | null): T | null {
    this.collection.revalidate();
    this.focus.sync(this.collection.items, this.resolved.container);
    this.sync();
    const total = this.collection.items.length;
    if (total === 0 || delta === 0) return null;
    const current = this.focus.index;
    const raw = current < 0 ? (delta > 0 ? 0 : total - 1) : current + delta;
    const target = clampIndex(raw, total, this.resolved.loop);
    const focused = this.focus.focusIndex(target, action);
    if (focused && action) this.afterMove(target, action, null);
    return focused;
  }

  protected resolveIndex(elementOrIndex?: T | number): number {
    if (elementOrIndex === undefined) return this.focus.index;
    if (typeof elementOrIndex === "number") return elementOrIndex;
    return this.collection.indexOf(elementOrIndex);
  }

  protected applySelection(index: number, extend = false): void {
    const manager = this.selectionManager;
    if (!manager) return;
    manager.select(index, extend);
  }

  protected extendRangeTo(index: number): void {
    const manager = this.selectionManager;
    if (!manager) return;
    const items = this.collection.items;
    const anchor = manager.anchor;
    const from = anchor ? items.indexOf(anchor) : index;
    if (from < 0) return;
    manager.selectRange(from, index);
  }

  protected onPointer(event: MouseEvent): void {
    const item = this.itemFromEvent(event);
    if (!item) return;
    const index = this.collection.indexOf(item);
    if (index === -1) return;

    this.focus.focusIndex(index, "select");

    const manager = this.selectionManager;
    if (!manager) return;
    const mode = manager.mode;
    if (mode === "none") return;
    if (mode === "multiple") {
      if (event.ctrlKey || event.metaKey) manager.toggle(index);
      else manager.select(index);
      return;
    }
    if (mode === "range" && event.shiftKey) {
      this.extendRangeTo(index);
      return;
    }
    this.applySelection(index, false);
  }

  protected onPointerOver(event: Event): void {
    const item = this.itemFromEvent(event);
    if (item) this.focus.observe(item, this.resolved.container);
  }

  protected itemFromEvent(event: Event): T | null {
    const target = event.target as Element | null;
    if (!target) return null;
    this.collection.revalidate();
    this.sync();
    const items = this.collection.items;
    const selector = this.resolved.selector;
    if (typeof selector === "string" && typeof target.closest === "function") {
      try {
        const closest = target.closest<T>(selector);
        if (closest && items.indexOf(closest) !== -1) return closest;
      } catch {
      }
    }
    let node: Element | null = target;
    while (node) {
      if (items.indexOf(node as T) !== -1) return node as T;
      node = node.parentElement;
    }
    return null;
  }

  protected sync(force = false): void {
    if (this.destroyed) return;
    if (!force && !this.syncPending) return;
    this.syncPending = false;
    const items = this.collection.items;
    this.focus.sync(items, this.resolved.container);
    this.selectionManager?.sync(items);
  }
}

function activatesNatively(element: Element): boolean {
  return element.matches("a[href],button,summary,input,select,textarea");
}

function clampIndex(index: number, total: number, loop: boolean): number {
  if (total === 0) return -1;
  if (loop) return ((index % total) + total) % total;
  if (index < 0) return 0;
  if (index >= total) return total - 1;
  return index;
}

export function createKeystra<T extends Element = HTMLElement>(options: KeystraOptions<T> = {}): KeystraInstance<T> {
  return new NavigationController<T>(options);
}

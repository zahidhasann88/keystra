export type ElementTarget<T extends Element = Element> =
  | T
  | string
  | null
  | undefined
  | (() => T | string | null | undefined);

export type ItemSelector<T extends Element = Element> =
  | string
  | ((container: Element) => ArrayLike<T> | Iterable<T>);

export type NavigationMode =
  | "sequential"
  | "vertical"
  | "horizontal"
  | "grid"
  | "directional"
  | "custom";

export type Direction = "up" | "down" | "left" | "right";

export type KeyAction =
  | "next"
  | "previous"
  | Direction
  | "first"
  | "last"
  | "pageUp"
  | "pageDown"
  | "select"
  | "toggle"
  | "escape"
  | "expand"
  | "collapse"
  | "typeahead"
  | (string & {});

export type SelectionMode = "single" | "multiple" | "range" | "none";

export type KeyBinding = string | KeyBindingObject;

export interface KeyBindingObject {
  key?: string;
  code?: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  allowWithoutModifiers?: boolean;
}

export type KeyBindingInput = KeyBinding | readonly KeyBinding[];

export type KeySequenceBinding = readonly KeyBinding[];

export interface KeySequenceOptions {
  readonly binding: KeySequenceBinding;
  readonly action: KeyAction;
  readonly timeout?: number;
  readonly preventDefault?: boolean;
}

export type KeySequenceInput = KeySequenceOptions;

export interface DefaultKeyMap {
  readonly next: KeyBindingInput;
  readonly previous: KeyBindingInput;
  readonly up: KeyBindingInput;
  readonly down: KeyBindingInput;
  readonly left: KeyBindingInput;
  readonly right: KeyBindingInput;
  readonly first: KeyBindingInput;
  readonly last: KeyBindingInput;
  readonly pageUp: KeyBindingInput;
  readonly pageDown: KeyBindingInput;
  readonly select: KeyBindingInput;
  readonly toggle: KeyBindingInput;
  readonly escape: KeyBindingInput;
  readonly expand: KeyBindingInput;
  readonly collapse: KeyBindingInput;
  readonly selectAll: KeyBindingInput;
}

export type KeyMap = {
  readonly [K in keyof DefaultKeyMap]?: KeyBindingInput | false | null;
} & {
  readonly [action: string]: KeyBindingInput | false | null | undefined;
};

export interface ParsedKeyBinding {
  readonly key: string | null;
  readonly code: string | null;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  readonly meta: boolean;
  readonly allowWithoutModifiers: boolean;
  readonly id: string;
}

export interface NormalizedKeyEvent {
  readonly key: string;
  readonly code: string;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  readonly meta: boolean;
  readonly isPlain: boolean;
  readonly isPrintable: boolean;
  readonly repeat: boolean;
  readonly shiftKey: boolean;
  readonly originalEvent: KeyboardEvent;
}

export interface KeystraEventMap<T extends Element = HTMLElement> {
  focus: { readonly element: T; readonly index: number; readonly action: KeyAction | null };
  blur: { readonly element: T; readonly index: number };
  select: { readonly element: T; readonly index: number };
  action: {
    readonly action: KeyAction;
    readonly event: KeyboardEvent | null;
    readonly element: T | null;
    readonly index: number;
    readonly fromSequence: boolean;
  };
  keydown: { readonly event: KeyboardEvent; readonly handled: boolean };
  selectionchange: { readonly selected: readonly T[]; readonly added: readonly T[]; readonly removed: readonly T[] };
  refresh: { readonly items: readonly T[] };
  destroy: Record<string, never>;
}

export type EventName = keyof KeystraEventMap;

export type EventPayload<E extends EventName, T extends Element = HTMLElement> = KeystraEventMap<T>[E];

export type EventHandler<E extends EventName, T extends Element = HTMLElement> = (
  payload: EventPayload<E, T>,
) => void;

export type Unsubscribe = () => void;

export interface TypeaheadOptions<T extends Element = HTMLElement> {
  readonly enabled?: boolean;
  readonly resetDelay?: number;
  readonly getText?: (element: T) => string;
  readonly onMatch?: (element: T | null, query: string) => void;
}

export interface RovingOptions {
  readonly enabled?: boolean;
  readonly force?: boolean;
}

export interface AutoFocusOptions<T extends Element = HTMLElement> {
  readonly enabled?: boolean;
  readonly target?: "first" | "last" | ((items: readonly T[]) => number);
}

export interface SelectionOptions<T extends Element = HTMLElement> {
  readonly enabled?: boolean;
  readonly mode?: SelectionMode;
  readonly initial?: readonly T[] | T | number | null;
  readonly followFocus?: boolean;
  readonly selectOnActivate?: boolean;
  readonly shiftExtendsRange?: boolean;
  readonly aria?: boolean;
  readonly attribute?: string;
  readonly selectedClass?: string;
  readonly onChange?: (selected: readonly T[]) => void;
}

export interface NavigationStrategyContext<T extends Element = HTMLElement> {
  readonly items: readonly T[];
  readonly container: Element | null;
  readonly index: number;
  readonly direction: Direction | null;
  readonly action: KeyAction;
  readonly event: KeyboardEvent | null;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly columns: number;
  readonly loop: boolean;
  readonly version: number;
  readonly rectOf: (element: T) => DOMRect;
}

export type NavigationStrategy<T extends Element = HTMLElement> = (
  context: NavigationStrategyContext<T>,
) => number | null | undefined;

export interface BaseOptions<T extends Element = HTMLElement> {
  readonly container?: ElementTarget<Element>;
  readonly items?: ItemSelector<T>;
  readonly elements?: readonly T[];
  readonly itemSelector?: string;
  readonly disabledSelector?: string | false | null;
  readonly filter?: (element: T, index: number) => boolean;
  readonly skipHidden?: boolean;

  readonly mode?: NavigationMode;
  readonly loop?: boolean;
  readonly columns?: number;
  readonly pageSize?: number;
  readonly strategy?: NavigationStrategy<T> | null;
  readonly onBeforeNavigate?: NavigationStrategy<T>;

  readonly keys?: KeyMap;
  readonly useDefaultKeys?: boolean;
  readonly sequences?: readonly KeySequenceInput[];
  readonly typeahead?: boolean | TypeaheadOptions<T>;

  readonly roving?: boolean | RovingOptions;

  readonly activeDescendant?: boolean | ElementTarget<HTMLElement>;
  readonly autoFocus?: boolean | AutoFocusOptions<T>;
  readonly selection?: boolean | SelectionOptions<T>;

  readonly observe?: boolean | MutationObserverInit;

  readonly onlyWhenFocusedInside?: boolean;
  readonly when?: () => boolean;
  readonly ignoreEditable?: boolean;
  readonly editableSelector?: string;
  readonly stopPropagation?: boolean;
  readonly preventDefault?: boolean;
  readonly capture?: boolean;
  readonly target?: EventTarget | string | null | (() => EventTarget | string | null | undefined);
  readonly enabled?: boolean;

  readonly pointerSync?: boolean;

  readonly onFocus?: (element: T, index: number) => void;
  readonly onBlur?: (element: T, index: number) => void;
  readonly onSelect?: (element: T, index: number) => void;
  readonly onAction?: (action: KeyAction, event: KeyboardEvent | null, element: T | null, index: number) => void;
  readonly onEscape?: (event: KeyboardEvent | null) => void;
  readonly onRefresh?: (items: readonly T[]) => void;
}

export interface KeystraOptions<T extends Element = HTMLElement> extends BaseOptions<T> {}

export interface SelectionController<T extends Element = HTMLElement> {
  readonly mode: SelectionMode;
  readonly selected: readonly T[];
  readonly selectedIndexes: readonly number[];
  readonly anchor: T | null;
  readonly items: readonly T[];
  select(elementOrIndex: T | number | undefined, extend?: boolean): void;
  toggle(elementOrIndex: T | number | undefined): void;
  deselect(elementOrIndex: T | number | undefined): void;
  selectRange(from: T | number | undefined, to: T | number | undefined): void;
  selectAll(): void;
  clear(): void;
  isSelected(elementOrIndex: T | number | undefined): boolean;
  indexOfSelected(element: T): number;
  setMode(mode: SelectionMode): void;
}

export interface KeystraInstance<T extends Element = HTMLElement> {
  readonly items: readonly T[];
  readonly container: Element | null;
  readonly activeElement: T | null;
  readonly activeIndex: number;
  readonly currentIndex: number;
  readonly mode: NavigationMode;
  readonly loop: boolean;
  readonly selection: SelectionController<T> | null;

  next(count?: number): T | null;
  previous(count?: number): T | null;
  up(): T | null;
  down(): T | null;
  left(): T | null;
  right(): T | null;
  move(direction: Direction): T | null;
  first(): T | null;
  last(): T | null;
  focusFirst(): T | null;
  focusLast(): T | null;
  pageUp(): T | null;
  pageDown(): T | null;
  focusIndex(index: number): T | null;
  setActiveIndex(index: number, options?: { focus?: boolean }): T | null;
  focusElement(element: T | null | undefined): boolean;
  select(elementOrIndex?: T | number): void;
  perform(action: KeyAction, event?: KeyboardEvent | null): boolean;
  restoreFocus(): boolean;
  refresh(): readonly T[];
  add(element: T | readonly T[]): void;
  remove(element: T | readonly T[]): void;
  setItems(elements: readonly T[] | null): void;
  readonly enabled: boolean;
  enable(): void;
  disable(): void;
  update(
    options: Partial<
      Pick<KeystraOptions<T>, "keys" | "loop" | "mode" | "columns" | "enabled" | "pageSize" | "container">
    >,
  ): void;
  on<E extends EventName>(event: E, handler: EventHandler<E, T>): Unsubscribe;
  off<E extends EventName>(event: E, handler?: EventHandler<E, T>): void;
  destroy(): void;
}

export interface TabsOptions<T extends HTMLElement = HTMLElement> extends BaseOptions<T> {
  readonly orientation?: "horizontal" | "vertical";
  readonly activation?: "automatic" | "manual";
  readonly activeAttribute?: string;
  readonly aria?: boolean;
  readonly panels?: ItemSelector<Element>;
  readonly panelActiveAttribute?: string;
  readonly onActivate?: (tab: T, index: number) => void;
}

export interface TabsInstance<T extends HTMLElement = HTMLElement> extends KeystraInstance<T> {
  readonly activeTab: T | null;
  readonly activeIndex: number;
  activate(indexOrElement: number | T | null): void;
  readonly orientation: "horizontal" | "vertical";
  readonly activation: "automatic" | "manual";
}

export interface MenuOptions<T extends HTMLElement = HTMLElement> extends BaseOptions<T> {
  readonly closeOnSelect?: boolean;
  readonly aria?: boolean;
  readonly returnFocusTo?: ElementTarget<HTMLElement>;
  readonly typeahead?: boolean | TypeaheadOptions<T>;
  readonly toggleHidden?: boolean;
  readonly onOpen?: (menu: MenuInstance<T>) => void;
  readonly onClose?: (menu: MenuInstance<T>) => void;
}

export interface MenuInstance<T extends HTMLElement = HTMLElement> extends KeystraInstance<T> {
  readonly isOpen: boolean;
  open(options?: { focus?: "first" | "last" | "current" | number }): void;
  close(options?: { restoreFocus?: boolean }): void;
  toggle(): void;
}

export interface DropdownOptions<T extends HTMLElement = HTMLElement> extends MenuOptions<T> {
  readonly trigger?: ElementTarget<HTMLElement>;
  readonly openKeys?: KeyBindingInput;
  readonly aria?: boolean;
  readonly closeOnBlur?: boolean;
  readonly closeOnOutsidePointer?: boolean;
}

export interface DropdownInstance<T extends HTMLElement = HTMLElement> extends MenuInstance<T> {
  readonly trigger: HTMLElement | null;
}

export interface ListOptions<T extends HTMLElement = HTMLElement> extends BaseOptions<T> {
  readonly selection?: boolean | SelectionOptions<T>;
  readonly aria?: boolean;
  readonly typeahead?: boolean | TypeaheadOptions<T>;
}

export interface GridOptions<T extends HTMLElement = HTMLElement> extends BaseOptions<T> {
  readonly columns?: number;
  readonly aria?: boolean;
  readonly maintainColumn?: boolean;
  readonly rowHomeEnd?: boolean;
}

export interface GridInstance<T extends HTMLElement = HTMLElement> extends KeystraInstance<T> {
  readonly columns: number;
  readonly rows: number;
  readonly position: { readonly row: number; readonly column: number };
  focusCell(row: number, column: number): T | null;
}

export interface TreeOptions<T extends HTMLElement = HTMLElement> extends BaseOptions<T> {
  readonly items?: ItemSelector<T>;
  readonly groupSelector?: string;
  readonly collapseBehavior?: "attribute" | "hidden" | "none";
  readonly aria?: boolean;
  readonly toggleHidden?: boolean;
  readonly hiddenClass?: string;
  readonly typeahead?: boolean | TypeaheadOptions<T>;
  readonly onExpand?: (node: T, index: number) => void;
  readonly onCollapse?: (node: T, index: number) => void;
}

export interface TreeInstance<T extends HTMLElement = HTMLElement> extends KeystraInstance<T> {
  expand(elementOrIndex?: T | number): void;
  collapse(elementOrIndex?: T | number): void;
  toggleExpanded(elementOrIndex?: T | number): void;
  expandAll(): void;
  collapseAll(): void;
  isExpanded(element: T): boolean;
  isExpandable(element: T): boolean;
  level(element: T): number;
  parent(element: T): T | null;
}

export interface CommandPaletteOptions<T extends HTMLElement = HTMLElement> extends BaseOptions<T> {
  readonly input?: ElementTarget<HTMLInputElement | HTMLTextAreaElement>;
  readonly toggleHidden?: boolean;
  readonly aria?: boolean;
  readonly list?: ElementTarget<Element>;
  readonly placeholder?: string;
  readonly onQuery?: (query: string) => void;
  readonly onSubmit?: (item: T | null, query: string) => void;
  readonly onCancel?: () => void;
  readonly openKeys?: KeyBindingInput;
}

export interface CommandPaletteInstance<T extends HTMLElement = HTMLElement> extends KeystraInstance<T> {
  readonly isOpen: boolean;
  readonly query: string;
  readonly input: HTMLInputElement | HTMLTextAreaElement | null;
  open(): void;
  close(options?: { restoreFocus?: boolean }): void;
  toggle(): void;
  setQuery(query: string): void;
}

export interface RovingFocusOptions<T extends HTMLElement = HTMLElement> extends BaseOptions<T> {
  readonly initialIndex?: number;
}

export interface HookOptions extends Omit<BaseOptions<HTMLElement>, "container" | "items" | "elements"> {
  readonly container?: ElementTarget<Element>;
  readonly items?: ItemSelector<HTMLElement>;
}

export interface KeystraHandle {
  readonly instance: KeystraInstance<HTMLElement> | null;
  readonly container: Element | null;
  attach(container: ElementTarget<Element> | null): KeystraInstance<HTMLElement> | null;
  detach(): void;
  destroy(): void;
}

export interface KeyBindingOptions {
  readonly target?: EventTarget | string | null;
  readonly capture?: boolean;
  readonly preventDefault?: boolean;
  readonly stopPropagation?: boolean;
  readonly allowInEditable?: boolean;
  readonly editableSelector?: string | null;
  readonly when?: () => boolean;
  readonly enabled?: boolean;
  readonly sequences?: readonly KeySequenceInput[];
}

export interface KeyBindingHandle {
  enable(): void;
  disable(): void;
  destroy(): void;
  matches(event: KeyboardEvent): boolean;
}

export { createKeystra, NavigationController } from "./core/engine.js";
export { KeyMatcher, createKeyMatcher, parseKeyBinding, keyEquals } from "./core/key-matcher.js";
export {
  normalizeKeyEvent,
  normalizeKeyName,
  isPrintableKey,
  isModifierKey,
  codeToKey,
  formatKeyCombo,
  describeEvent,
} from "./core/keyboard.js";
export { EventManager, createRafThrottle } from "./core/event-manager.js";
export { ItemCollection, createRectOf } from "./core/item-collection.js";
export { createTypeahead } from "./core/typeahead.js";
export { defaultKeysFor, mergeKeys } from "./core/default-keys.js";
export { useKeystra, createKeyBinding } from "./core/hooks.js";
export type { KeyBindingHandler, KeyBindingInfo } from "./core/hooks.js";

export {
  createSequentialStrategy,
  findNextIndex,
  actionDelta,
  verticalStrategy,
  horizontalStrategy,
} from "./navigation/sequential.js";
export { createDirectionalStrategy, actionToDirection } from "./navigation/directional.js";
export { createGridStrategy, directionFromAction } from "./navigation/grid.js";
export { createCustomStrategy, composeStrategies } from "./navigation/custom.js";

export { FocusManager } from "./focus/focus-manager.js";
export { RovingTabindex } from "./focus/roving-focus.js";

export { SelectionManager } from "./selection/selection-manager.js";

export { createTabs } from "./patterns/tabs.js";
export { createMenu } from "./patterns/menu.js";
export { createDropdown } from "./patterns/dropdown.js";
export { createList } from "./patterns/list.js";
export { createGrid } from "./patterns/grid.js";
export { createTree } from "./patterns/tree.js";
export { createCommandPalette } from "./patterns/command-palette.js";
export { createRovingFocus } from "./patterns/roving-focus.js";

export {
  hasDom,
  resolveElement,
  queryItems,
  isDisabled,
  isHidden,
  isFocusable,
  isEditableTarget,
  getText,
  setAttribute,
  toggleClass,
  focusElement,
  contains,
} from "./utils/dom.js";
export { Emitter } from "./utils/emitter.js";
export { LayoutCache } from "./utils/layout.js";

export type * from "./types/index.js";
export type { ResolvedOptions } from "./core/engine.js";
export type { MatchResult } from "./core/key-matcher.js";
export type { ItemCollectionOptions } from "./core/item-collection.js";
export type { TypeaheadController } from "./core/typeahead.js";
export type { FocusManagerOptions } from "./focus/focus-manager.js";
export type { RovingTabindexOptions } from "./focus/roving-focus.js";
export type { SelectionDiffHandler } from "./selection/selection-manager.js";
export type { DirectionalOptions } from "./navigation/directional.js";
export type { GridStrategyOptions } from "./navigation/grid.js";
export type { CustomStrategyHooks } from "./navigation/custom.js";

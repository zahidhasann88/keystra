import type { KeyMap, NavigationMode } from "../types/index.js";

const NAVIGATION = {
  first: ["Home"],
  last: ["End"],
  pageUp: ["PageUp"],
  pageDown: ["PageDown"],
  escape: ["Escape"],
  selectAll: ["Ctrl+A", "Meta+A"],
} as const;

export const VERTICAL_KEYS: KeyMap = {
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  next: ["ArrowDown"],
  previous: ["ArrowUp"],
  toggle: ["Space"],
  select: ["Enter", "Space"],
  ...NAVIGATION,
};

export const HORIZONTAL_KEYS: KeyMap = {
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  next: ["ArrowRight"],
  previous: ["ArrowLeft"],
  toggle: ["Space"],
  select: ["Enter", "Space"],
  ...NAVIGATION,
};

export const ROVING_KEYS: KeyMap = {
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  next: ["ArrowDown", "ArrowRight"],
  previous: ["ArrowUp", "ArrowLeft"],
  toggle: ["Space"],
  select: ["Enter", "Space"],
  ...NAVIGATION,
};

export const TABS_KEYS_HORIZONTAL: KeyMap = {
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  next: ["ArrowRight"],
  previous: ["ArrowLeft"],
  first: ["Home"],
  last: ["End"],
  select: ["Enter", "Space"],
  escape: ["Escape"],
};

export const TABS_KEYS_VERTICAL: KeyMap = {
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  next: ["ArrowDown"],
  previous: ["ArrowUp"],
  first: ["Home"],
  last: ["End"],
  select: ["Enter", "Space"],
  escape: ["Escape"],
};

export const GRID_KEYS: KeyMap = {
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  next: ["ArrowDown"],
  previous: ["ArrowUp"],
  first: ["Home"],
  last: ["End"],
  pageUp: ["PageUp"],
  pageDown: ["PageDown"],
  select: ["Enter", "Space"],
  escape: ["Escape"],
};

export const MENU_KEYS: KeyMap = {
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  next: ["ArrowDown"],
  previous: ["ArrowUp"],
  first: ["Home"],
  last: ["End"],
  select: ["Enter", "Space"],
  escape: ["Escape"],
};

export const TREE_KEYS: KeyMap = {
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  next: ["ArrowDown"],
  previous: ["ArrowUp"],
  expand: ["ArrowRight"],
  collapse: ["ArrowLeft"],
  first: ["Home"],
  last: ["End"],
  select: ["Enter", "Space"],
  escape: ["Escape"],
};

export const LIST_KEYS: KeyMap = {
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  next: ["ArrowDown"],
  previous: ["ArrowUp"],
  first: ["Home"],
  last: ["End"],
  pageUp: ["PageUp"],
  pageDown: ["PageDown"],
  toggle: ["Space"],
  select: ["Enter"],
  selectAll: ["Ctrl+A", "Meta+A"],
  escape: ["Escape"],
};

export const COMMAND_PALETTE_KEYS: KeyMap = {
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  next: ["ArrowDown"],
  previous: ["ArrowUp"],
  pageUp: ["PageUp"],
  pageDown: ["PageDown"],
  select: ["Enter"],
  escape: ["Escape"],
};

export function defaultKeysFor(mode: NavigationMode): KeyMap {
  switch (mode) {
    case "horizontal":
      return HORIZONTAL_KEYS;
    case "grid":
    case "directional":
      return GRID_KEYS;
    case "sequential":
    case "vertical":
    case "custom":
    default:
      return VERTICAL_KEYS;
  }
}

export function mergeKeys(defaults: KeyMap, user: KeyMap | undefined | null, useDefaults: boolean): KeyMap {
  if (!useDefaults) return { ...(user ?? {}) };
  const merged: Record<string, unknown> = { ...defaults };
  if (user) {
    for (const action of Object.keys(user)) {
      const value = user[action];
      if (value === undefined) continue;
      if (value === false || value === null) delete merged[action];
      else merged[action] = value;
    }
  }
  return merged as KeyMap;
}

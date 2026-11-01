import type { KeystraInstance, RovingFocusOptions } from "../types/index.js";
import { createKeystra } from "../core/engine.js";
import { ROVING_KEYS } from "../core/default-keys.js";

export function createRovingFocus<T extends HTMLElement = HTMLElement>(
  options: RovingFocusOptions<T> = {},
): KeystraInstance<T> {
  const instance = createKeystra<T>({
    keys: options.mode === undefined ? ROVING_KEYS : undefined,
    loop: true,
    roving: true,
    ...options,
  });

  const items = instance.items;
  if (items.length === 0) return instance;

  let initial = options.initialIndex ?? -1;
  if (initial < 0) {
    for (let i = 0; i < items.length; i++) {
      if (items[i]!.getAttribute("tabindex") === "0") {
        initial = i;
        break;
      }
    }
  }
  if (initial > 0) instance.setActiveIndex(initial, { focus: false });

  return instance;
}

import type { TypeaheadOptions } from "../types/index.js";
import { getText } from "../utils/dom.js";

export interface TypeaheadController<T extends Element = HTMLElement> {
  handle(character: string, items: readonly T[], currentIndex: number): T | null;
  readonly query: string;
  reset(): void;
  dispose(): void;
}

export function createTypeahead<T extends Element = HTMLElement>(
  options: TypeaheadOptions<T> = {},
): TypeaheadController<T> {
  const resetDelay = options.resetDelay ?? 600;
  const getTextFor = options.getText ?? ((element: T) => getText(element));

  let buffer = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastMatch = -1;

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function reset(): void {
    buffer = "";
    lastMatch = -1;
    clearTimer();
  }

  return {
    get query() {
      return buffer;
    },
    reset,
    dispose: reset,

    handle(character: string, items: readonly T[], currentIndex: number): T | null {
      if (!character) return null;
      const total = items.length;
      if (total === 0) return null;

      const previousBuffer = buffer;
      buffer += character.toLowerCase();
      if (buffer.length > 12) buffer = buffer.slice(-12);

      clearTimer();
      if (typeof setTimeout === "function") timer = setTimeout(reset, resetDelay);

      const repeating = buffer.length > 1 && previousBuffer.length === 1 && buffer === previousBuffer + previousBuffer;
      let query = repeating ? previousBuffer : buffer;

      const collect = (prefix: string): number[] => {
        const found: number[] = [];
        for (let i = 0; i < total; i++) {
          const text = getTextFor(items[i]!);
          if (text && text.toLowerCase().startsWith(prefix)) found.push(i);
        }
        return found;
      };

      let matches = collect(query);
      if (matches.length === 0 && query.length > 1) {
        query = character.toLowerCase();
        buffer = query;
        matches = collect(query);
      }
      if (matches.length === 0) {
        options.onMatch?.(null, query);
        return null;
      }

      let pick: number;
      if (repeating) {
        const position = matches.indexOf(lastMatch);
        pick = matches[(position + 1) % matches.length]!;
      } else if (query === previousBuffer && previousBuffer.length > 0) {
        const position = matches.indexOf(lastMatch);
        pick = matches[(position + 1) % matches.length]!;
      } else {
        pick = matches[0]!;
        for (let i = 0; i < matches.length; i++) {
          if (matches[i]! > currentIndex) {
            pick = matches[i]!;
            break;
          }
        }
      }

      lastMatch = pick;
      const element = items[pick] ?? null;
      options.onMatch?.(element, query);
      return element;
    },
  };
}

import type { Direction, KeyAction, NavigationStrategy, NavigationStrategyContext } from "../types/index.js";

export type { NavigationStrategy, NavigationStrategyContext };

export function findNextIndex(
  total: number,
  from: number,
  step: number,
  loop: boolean,
  clamp = true,
): number {
  if (total === 0 || step === 0) return -1;

  if (from < 0 || from >= total) {
    return step > 0 ? 0 : total - 1;
  }

  const next = from + step;

  if (loop) return ((next % total) + total) % total;
  if (next < 0) return clamp ? 0 : -1;
  if (next >= total) return clamp ? total - 1 : -1;
  return next;
}

export function actionDelta(action: KeyAction, direction: Direction | null): number {
  if (direction) {
    if (direction === "down" || direction === "right") return 1;
    if (direction === "up" || direction === "left") return -1;
    return 0;
  }
  switch (action) {
    case "next":
    case "down":
    case "right":
      return 1;
    case "previous":
    case "up":
    case "left":
      return -1;
    default:
      return 0;
  }
}

export function createSequentialStrategy<T extends Element = HTMLElement>(
  axis: "vertical" | "horizontal" | "both" = "both",
): NavigationStrategy<T> {
  return (context) => {
    const { action, direction, index, items, loop } = context;
    const delta = actionDelta(action, direction);
    if (delta === 0) return null;

    const isVerticalAction =
      direction !== null ? direction === "up" || direction === "down" : action === "up" || action === "down";
    if (axis === "vertical" && !isVerticalAction && direction !== null) return null;
    if (axis === "horizontal" && isVerticalAction) return null;

    return findNextIndex(items.length, index, delta, loop);
  };
}

export const verticalStrategy: NavigationStrategy<HTMLElement> = /* @__PURE__ */ createSequentialStrategy<HTMLElement>("vertical");

export const horizontalStrategy: NavigationStrategy<HTMLElement> = /* @__PURE__ */ createSequentialStrategy<HTMLElement>("horizontal");

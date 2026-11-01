import type { Direction, KeyAction, NavigationStrategy, NavigationStrategyContext } from "../types/index.js";

export interface DirectionalOptions {
  readonly crossAxisWeight?: number;
  readonly wrapFallback?: boolean;
}

export function actionToDirection(action: KeyAction): Direction | null {
  switch (action) {
    case "up":
      return "up";
    case "down":
      return "down";
    case "left":
      return "left";
    case "right":
      return "right";
    default:
      return null;
  }
}

export function createDirectionalStrategy<T extends Element = HTMLElement>(
  options: DirectionalOptions = {},
): NavigationStrategy<T> {
  const crossWeight = options.crossAxisWeight ?? 2;

  return (context: NavigationStrategyContext<T>) => {
    const direction = context.direction ?? actionToDirection(context.action);
    if (!direction) return null;

    const items = context.items;
    const total = items.length;
    if (total === 0) return -1;

    const from = context.index;
    if (from < 0 || from >= total) {
      return direction === "down" || direction === "right" ? 0 : total - 1;
    }

    const current = items[from];
    if (!current) return null;

    const origin = context.rectOf(current);
    const ox = origin.left + origin.width / 2;
    const oy = origin.top + origin.height / 2;
    const horizontal = direction === "left" || direction === "right";
    const sign = direction === "right" || direction === "down" ? 1 : -1;

    let bestIndex = -1;
    let bestScore = Infinity;
    let nearestIndex = -1;
    let nearestDistance = Infinity;

    for (let i = 0; i < total; i++) {
      if (i === from) continue;
      const element = items[i]!;
      const rect = context.rectOf(element);
      if (rect.width === 0 && rect.height === 0) continue;

      const dx = rect.left + rect.width / 2 - ox;
      const dy = rect.top + rect.height / 2 - oy;
      const distance = Math.hypot(dx, dy);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }

      const primary = (horizontal ? dx : dy) * sign;
      if (primary <= 0) continue;
      const cross = Math.abs(horizontal ? dy : dx);
      if (cross > primary) continue;

      const score = primary + cross * crossWeight;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex !== -1) return bestIndex;

    const allowFallback = options.wrapFallback ?? context.loop;
    return allowFallback ? nearestIndex : null;
  };
}

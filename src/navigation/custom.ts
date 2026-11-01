import type { NavigationStrategy, NavigationStrategyContext } from "../types/index.js";

export interface CustomStrategyHooks<T extends Element = HTMLElement> {
  readonly onNavigate?: (context: NavigationStrategyContext<T>) => number | null | undefined;
  readonly fallback?: NavigationStrategy<T> | null;
  readonly onAction?: (context: NavigationStrategyContext<T>) => number | null | undefined;
}

export function createCustomStrategy<T extends Element = HTMLElement>(
  hooks: CustomStrategyHooks<T> | ((context: NavigationStrategyContext<T>) => number | null | undefined),
): NavigationStrategy<T> {
  const resolved: CustomStrategyHooks<T> = typeof hooks === "function" ? { onNavigate: hooks } : hooks;

  return (context) => {
    if (context.direction || isMovementAction(context.action)) {
      const result = resolved.onNavigate?.(context);
      if (typeof result === "number") return result;
      return resolved.fallback ? resolved.fallback(context) : null;
    }
    const result = resolved.onAction?.(context);
    if (typeof result === "number") return result;
    return resolved.onNavigate?.(context) ?? null;
  };
}

export function composeStrategies<T extends Element = HTMLElement>(
  ...strategies: (NavigationStrategy<T> | null | undefined)[]
): NavigationStrategy<T> {
  const list = strategies.filter(Boolean) as NavigationStrategy<T>[];
  return (context) => {
    for (let i = 0; i < list.length; i++) {
      const result = list[i]!(context);
      if (typeof result === "number" && result >= 0) return result;
    }
    return null;
  };
}

function isMovementAction(action: string): boolean {
  return (
    action === "next" ||
    action === "previous" ||
    action === "first" ||
    action === "last" ||
    action === "pageUp" ||
    action === "pageDown"
  );
}

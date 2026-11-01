import type { Direction, KeyAction, NavigationStrategy, NavigationStrategyContext } from "../types/index.js";

export interface GridStrategyOptions {
  readonly columns?: number;
  readonly maintainColumn?: boolean;
  readonly rowHomeEnd?: boolean;
}

interface GridInfo {
  readonly starts: readonly number[];
  readonly columns: number;
}

export function computeGridInfo<T extends Element>(context: NavigationStrategyContext<T>): GridInfo {
  const items = context.items;
  const total = items.length;
  if (total === 0) return { starts: [0], columns: 1 };

  const starts: number[] = [0];
  let rowTop = context.rectOf(items[0]!).top;
  let currentColumns = 1;
  let maxColumns = 1;

  for (let i = 1; i < total; i++) {
    const rect = context.rectOf(items[i]!);
    if (Math.abs(rect.top - rowTop) < 2) {
      currentColumns++;
      continue;
    }
    maxColumns = Math.max(maxColumns, currentColumns);
    currentColumns = 1;
    rowTop = rect.top;
    starts.push(i);
  }

  return { starts, columns: Math.max(maxColumns, currentColumns) };
}

function declaredInfo(total: number, columns: number): GridInfo {
  const starts: number[] = [];
  for (let start = 0; start < total; start += columns) starts.push(start);
  if (starts.length === 0) starts.push(0);
  return { starts, columns };
}

function rowOf(info: GridInfo, index: number): number {
  const starts = info.starts;
  let row = 0;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i]! <= index) row = i;
    else break;
  }
  return row;
}

function rowStart(info: GridInfo, row: number): number {
  return info.starts[row] ?? 0;
}

function rowEnd(info: GridInfo, row: number, total: number): number {
  return row + 1 < info.starts.length ? info.starts[row + 1]! - 1 : total - 1;
}

export function createGridStrategy<T extends Element = HTMLElement>(
  options: GridStrategyOptions = {},
): NavigationStrategy<T> {
  const maintainColumn = options.maintainColumn !== false;
  const rowHomeEnd = options.rowHomeEnd === true;
  const declared = options.columns && options.columns > 0 ? options.columns : 0;

  let cachedVersion = -1;
  let cachedItems: readonly T[] | null = null;
  let cached: GridInfo = { starts: [0], columns: 1 };

  return (context: NavigationStrategyContext<T>) => {
    const items = context.items;
    const total = items.length;
    if (total === 0) return -1;

    const columns = declared || context.columns;
    const index = context.index;
    const direction: Direction | null = context.direction ?? directionFromAction(context.action);

    if (!direction) {
      if (context.action === "first") {
        if (!rowHomeEnd || index < 0) return 0;
        const info = infoFor(context, columns, total);
        return rowStart(info, rowOf(info, index));
      }
      if (context.action === "last") {
        if (!rowHomeEnd || index < 0) return total - 1;
        const info = infoFor(context, columns, total);
        return rowEnd(info, rowOf(info, index), total);
      }
      return null;
    }

    if (index < 0 || index >= total) {
      return direction === "down" || direction === "right" ? 0 : total - 1;
    }

    const info = infoFor(context, columns, total);
    const row = rowOf(info, index);
    const start = rowStart(info, row);
    const end = rowEnd(info, row, total);

    if (direction === "left" || direction === "right") {
      const next = index + (direction === "right" ? 1 : -1);
      if (next >= start && next <= end) return next;
      if (!context.loop) return index;
      return direction === "right" ? start : end;
    }

    const rowDelta = direction === "down" ? 1 : -1;
    let targetRow = row + rowDelta;

    if (targetRow < 0 || targetRow >= info.starts.length) {
      if (!context.loop) return index;
      targetRow = targetRow < 0 ? info.starts.length - 1 : 0;
    }

    const targetStart = rowStart(info, targetRow);
    const targetEnd = rowEnd(info, targetRow, total);

    if (columns > 0 && !maintainColumn) return targetStart;
    if (columns > 0) {
      const column = index - start;
      const candidate = targetStart + column;
      return candidate <= targetEnd ? candidate : targetEnd;
    }

    const current = context.rectOf(items[index]!);
    return nearestInRow(context, targetStart, targetEnd, current.left + current.width / 2);

    function infoFor(ctx: NavigationStrategyContext<T>, cols: number, count: number): GridInfo {
      if (cols > 0) return declaredInfo(count, cols);
      if (cachedVersion === ctx.version && cachedItems === ctx.items) return cached;
      cached = computeGridInfo(ctx);
      cachedVersion = ctx.version;
      cachedItems = ctx.items;
      return cached;
    }
  };
}

function nearestInRow<T extends Element>(
  context: NavigationStrategyContext<T>,
  start: number,
  end: number,
  targetX: number,
): number {
  let best = start;
  let bestDistance = Infinity;
  for (let i = start; i <= end; i++) {
    const element = context.items[i];
    if (!element) continue;
    const rect = context.rectOf(element);
    const distance = Math.abs(rect.left + rect.width / 2 - targetX);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

export function directionFromAction(action: KeyAction): Direction | null {
  switch (action) {
    case "up":
    case "previous":
      return "up";
    case "down":
    case "next":
      return "down";
    case "left":
      return "left";
    case "right":
      return "right";
    default:
      return null;
  }
}

import type { GridInstance, GridOptions } from "../types/index.js";
import { NavigationController } from "../core/engine.js";
import { createGridStrategy } from "../navigation/grid.js";
import { ensureRole } from "./shared.js";

class GridController<T extends HTMLElement = HTMLElement>
  extends NavigationController<T>
  implements GridInstance<T>
{
  private readonly manageAria: boolean;

  constructor(options: GridOptions<T>) {
    super(options, {
      mode: "grid",
      loop: options.loop ?? false,
      columns: options.columns ?? 0,
      strategy: createGridStrategy<T>({
        maintainColumn: options.maintainColumn,
        rowHomeEnd: options.rowHomeEnd,
      }),
    });

    this.manageAria = options.aria !== false;

    this.decorateRoles();
    this.on("refresh", () => this.decorateRoles());
  }

  private decorateRoles(): void {
    const container = this.container;
    if (!this.manageAria || !container) return;
    if (container.querySelector("[role='row']") === null) return;

    ensureRole(container, "grid", true);
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (item.parentElement?.getAttribute("role") === "row") ensureRole(item, "gridcell", true);
    }
  }

  get columns(): number {
    if (this.resolved.columns > 0) return this.resolved.columns;
    const items = this.items;
    if (items.length === 0) return 0;
    let columns = 1;
    const first = items[0]!;
    const top = this.rectOf(first).top;
    for (let i = 1; i < items.length; i++) {
      if (Math.abs(this.rectOf(items[i]!).top - top) < 2) columns++;
      else break;
    }
    return columns;
  }

  get rows(): number {
    const columns = this.columns;
    if (columns <= 0) return 0;
    return Math.ceil(this.items.length / columns);
  }

  get position(): { readonly row: number; readonly column: number } {
    const index = this.activeIndex;
    const columns = this.columns;
    if (index < 0 || columns <= 0) return { row: -1, column: -1 };
    return { row: Math.floor(index / columns), column: index % columns };
  }

  focusCell(row: number, column: number): T | null {
    const columns = this.columns;
    if (columns <= 0) return null;
    const index = row * columns + column;
    if (index < 0 || index >= this.items.length) return null;
    return this.focusIndex(index);
  }

  private rectOf(element: T): DOMRect {
    return this.collection.layout.rect(element, this.collection.version);
  }
}

export function createGrid<T extends HTMLElement = HTMLElement>(options: GridOptions<T> = {}): GridInstance<T> {
  return new GridController<T>(options);
}

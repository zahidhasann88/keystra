import type { EventName, EventHandler, KeystraEventMap } from "../types/index.js";

export class Emitter<T extends Element = HTMLElement> {
  private handlers: Map<EventName, Set<EventHandler<EventName, T>>> | null = null;

  on<E extends EventName>(event: E, handler: EventHandler<E, T>): () => void {
    if (!this.handlers) this.handlers = new Map();
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as EventHandler<EventName, T>);
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      this.off(event, handler);
    };
  }

  off<E extends EventName>(event: E, handler?: EventHandler<E, T>): void {
    const set = this.handlers?.get(event);
    if (!set) return;
    if (handler) set.delete(handler as EventHandler<EventName, T>);
    else set.clear();
    if (set.size === 0) this.handlers?.delete(event);
  }

  emit<E extends EventName>(event: E, payload: KeystraEventMap<T>[E]): void {
    const set = this.handlers?.get(event);
    if (!set || set.size === 0) return;
    for (const handler of Array.from(set)) {
      (handler as EventHandler<E, T>)(payload);
    }
  }

  clear(): void {
    this.handlers?.clear();
    this.handlers = null;
  }

  get size(): number {
    if (!this.handlers) return 0;
    let total = 0;
    for (const set of this.handlers.values()) total += set.size;
    return total;
  }
}

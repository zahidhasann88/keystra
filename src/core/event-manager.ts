export type Listener = (event: Event) => void;

interface Record_ {
  readonly target: EventTarget;
  readonly type: string;
  readonly listener: Listener;
  readonly options: AddEventListenerOptions | boolean;
}

export class EventManager {
  private records: Record_[] = [];

  add(
    target: EventTarget | null | undefined,
    type: string,
    listener: Listener,
    options?: AddEventListenerOptions | boolean,
  ): () => void {
    if (!target || typeof target.addEventListener !== "function") return () => {};
    target.addEventListener(type, listener, options);
    const record: Record_ = { target, type, listener, options: options ?? false };
    this.records.push(record);
    return () => this.removeRecord(record);
  }

  private removeRecord(record: Record_): void {
    const index = this.records.indexOf(record);
    if (index === -1) return;
    this.records.splice(index, 1);
    record.target.removeEventListener(record.type, record.listener, record.options);
  }

  dispose(): void {
    for (let i = this.records.length - 1; i >= 0; i--) {
      const record = this.records[i]!;
      record.target.removeEventListener(record.type, record.listener, record.options);
    }
    this.records.length = 0;
  }

  get count(): number {
    return this.records.length;
  }
}

export function createRafThrottle(callback: () => void): {
  schedule: () => void;
  cancel: () => void;
} {
  let queued = false;
  const raf =
    typeof globalThis.requestAnimationFrame === "function"
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : (fn: () => void) => setTimeout(fn, 16) as unknown as number;
  const cancelRaf =
    typeof globalThis.cancelAnimationFrame === "function"
      ? globalThis.cancelAnimationFrame.bind(globalThis)
      : (id: number) => clearTimeout(id);
  let handle: number | null = null;

  return {
    schedule() {
      if (queued) return;
      queued = true;
      handle = raf(() => {
        queued = false;
        handle = null;
        callback();
      }) as number;
    },
    cancel() {
      if (handle !== null) cancelRaf(handle);
      handle = null;
      queued = false;
    },
  };
}

export class LayoutCache {
  private rects = new WeakMap<Element, { version: number; rect: DOMRect }>();

  rect(element: Element, version: number): DOMRect {
    const cached = this.rects.get(element);
    if (cached && cached.version === version) return cached.rect;
    const rect = (element as HTMLElement).getBoundingClientRect();
    this.rects.set(element, { version, rect });
    return rect;
  }
}

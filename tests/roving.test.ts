import { afterEach, describe, expect, it } from "vitest";
import { createKeystra, RovingTabindex } from "../src/index.js";
import type { KeystraInstance } from "../src/types/index.js";
import { makeList, press, resetDom } from "./helpers.js";

const instances: KeystraInstance<HTMLElement>[] = [];
function create(options: Parameters<typeof createKeystra<HTMLElement>>[0]) {
  const instance = createKeystra(options);
  instances.push(instance);
  return instance;
}

afterEach(() => {
  while (instances.length) instances.pop()?.destroy();
  resetDom();
});

describe("roving tabindex", () => {
  it("keeps exactly one tab stop in the group", () => {
    const { items } = makeList(4);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(0);

    expect(items.map((element) => element.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1"]);
    press("ArrowDown");
    expect(items.map((element) => element.getAttribute("tabindex"))).toEqual(["-1", "0", "-1", "-1"]);
    press("ArrowDown");
    expect(items.map((element) => element.getAttribute("tabindex"))).toEqual(["-1", "-1", "0", "-1"]);
  });

  it("keeps the tab stop on a group member after focus leaves", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(1);
    items[1]!.blur();
    document.body.focus();
    nav.refresh();
    expect(items[1]!.getAttribute("tabindex")).toBe("0");
    expect(items[0]!.getAttribute("tabindex")).toBe("-1");
    expect(nav.activeIndex).toBe(-1);
  });

  it("never promotes an element the author took out of the tab order", () => {
    const { items } = makeList(3);
    items[1]!.setAttribute("tabindex", "-1");
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(1);
    expect(items[1]!.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(items[1]);
  });

  it("can be forced to promote anyway", () => {
    const { items } = makeList(3);
    items[1]!.setAttribute("tabindex", "-1");
    const nav = create({ container: "#group", items: "button", roving: { enabled: true, force: true } });
    nav.focusIndex(1);
    expect(items[1]!.getAttribute("tabindex")).toBe("0");
  });

  it("restores every original tabindex on destroy", () => {
    const { items } = makeList(4);
    items[0]!.setAttribute("tabindex", "0");
    items[2]!.setAttribute("tabindex", "3");
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(3);
    expect(items[3]!.getAttribute("tabindex")).toBe("0");

    nav.destroy();
    expect(items[0]!.getAttribute("tabindex")).toBe("0");
    expect(items[1]!.getAttribute("tabindex")).toBeNull();
    expect(items[2]!.getAttribute("tabindex")).toBe("3");
    expect(items[3]!.getAttribute("tabindex")).toBeNull();
  });

  it("can be turned off entirely", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", roving: false });
    nav.focusIndex(1);
    expect(items.every((element) => element.getAttribute("tabindex") === null)).toBe(true);
    expect(document.activeElement).toBe(items[1]);
  });

  it("writes each attribute only once per state change", () => {
    const { items } = makeList(4);
    let writes = 0;
    for (const element of items) {
      const original = element.setAttribute.bind(element);
      element.setAttribute = (name: string, value: string) => {
        if (name === "tabindex") writes += 1;
        original(name, value);
      };
    }
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(0);
    const afterFirst = writes;
    expect(afterFirst).toBe(4);

    for (let i = 0; i < 10; i++) nav.refresh();
    expect(writes).toBe(afterFirst);

    press("ArrowDown");
    expect(writes).toBe(afterFirst + 2);
  });

  it("moves the tab stop without moving focus when asked", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button" });
    nav.focusIndex(0);
    nav.setActiveIndex(2, { focus: false });
    expect(items[2]!.getAttribute("tabindex")).toBe("0");
    expect(items[0]!.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(items[0]);
  });
});

describe("RovingTabindex used standalone", () => {
  it("syncs, applies and restores", () => {
    const { items } = makeList(3);
    const roving = new RovingTabindex<HTMLElement>();
    roving.sync(items[1]!, items);
    expect(items.map((element) => element.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);

    roving.apply(items[2]!);
    expect(items[2]!.getAttribute("tabindex")).toBe("0");
    expect(roving.activeElement).toBe(items[2]);
    expect(roving.touched).toBe(3);

    roving.restore();
    expect(items.every((element) => element.getAttribute("tabindex") === null)).toBe(true);
    expect(roving.activeElement).toBeNull();
  });

  it("does nothing when disabled", () => {
    const { items } = makeList(2);
    const roving = new RovingTabindex<HTMLElement>({ disabled: true });
    roving.sync(items[0]!, items);
    roving.apply(items[1]!);
    expect(items.every((element) => element.getAttribute("tabindex") === null)).toBe(true);
  });

  it("respects a deliberate negative tabindex", () => {
    const { items } = makeList(2);
    items[0]!.setAttribute("tabindex", "-1");
    const roving = new RovingTabindex<HTMLElement>();
    roving.sync(items[0]!, items);
    expect(items[0]!.getAttribute("tabindex")).toBe("-1");

    const forced = new RovingTabindex<HTMLElement>({ respectNegative: false });
    forced.sync(items[0]!, items);
    expect(items[0]!.getAttribute("tabindex")).toBe("0");
  });
});

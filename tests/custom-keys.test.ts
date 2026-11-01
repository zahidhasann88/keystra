import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createKeyBinding,
  createKeystra,
  useKeystra,
  type KeystraInstance,
} from "../src/index.js";
import { makeList, press, pressed, resetDom } from "./helpers.js";

const instances: { destroy(): void }[] = [];

function track<T extends { destroy(): void }>(instance: T): T {
  instances.push(instance);
  return instance;
}

function create(options: Parameters<typeof createKeystra>[0]): KeystraInstance {
  return track(createKeystra(options)) as KeystraInstance;
}

afterEach(() => {
  while (instances.length > 0) instances.pop()!.destroy();
  resetDom();
});

describe("custom key maps", () => {
  it("accepts a single binding string", () => {
    const { items } = makeList(4);
    const nav = create({ container: "#group", items: "button", keys: { next: "j", previous: "k" } });

    nav.focusIndex(0);
    press("j");
    expect(document.activeElement).toBe(items[1]);
    press("k");
    expect(document.activeElement).toBe(items[0]);
  });

  it("keeps the default bindings for actions you did not mention", () => {
    const { items } = makeList(4);
    const nav = create({ container: "#group", items: "button", keys: { next: "j" } });

    nav.focusIndex(0);
    press("ArrowDown");
    expect(document.activeElement).toBe(items[1]);
    press("j");
    expect(document.activeElement).toBe(items[2]);
    press("Home");
    expect(document.activeElement).toBe(items[0]);
  });

  it("replaces every binding of an action you did mention", () => {
    const { items } = makeList(4);
    const nav = create({ container: "#group", items: "button", keys: { next: "j" } });

    nav.focusIndex(0);
    press("ArrowDown");
    expect(document.activeElement).toBe(items[1]);
  });

  it("accepts several bindings for one action", () => {
    const { items } = makeList(4);
    const nav = create({
      container: "#group",
      items: "button",
      keys: { next: ["j", "ArrowDown", "Tab"] },
    });

    nav.focusIndex(0);
    for (const key of ["j", "ArrowDown", "Tab"]) {
      press(key);
    }
    expect(document.activeElement).toBe(items[3]);
  });

  it("removes a binding with false", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", keys: { next: false, down: false } });

    nav.focusIndex(0);
    expect(pressed("ArrowDown")).toBe(true);
    expect(document.activeElement).toBe(items[0]);
  });

  it("drops the whole default map with useDefaultKeys: false", () => {
    const { items } = makeList(3);
    const nav = create({
      container: "#group",
      items: "button",
      useDefaultKeys: false,
      keys: { next: "j" },
    });

    nav.focusIndex(0);
    expect(pressed("ArrowDown")).toBe(true);
    expect(pressed("Home")).toBe(true);
    expect(pressed("Escape")).toBe(true);
    expect(document.activeElement).toBe(items[0]);

    press("j");
    expect(document.activeElement).toBe(items[1]);
  });

  it("supports modifier chords", () => {
    const { items } = makeList(4);
    const nav = create({
      container: "#group",
      items: "button",
      keys: { next: "Ctrl+ArrowDown", first: "Alt+Home", last: ["Meta+ArrowRight"] },
    });

    nav.focusIndex(0);
    press("ArrowDown");
    expect(document.activeElement).toBe(items[1]);

    press("ArrowDown", { ctrlKey: true });
    expect(document.activeElement).toBe(items[2]);

    press("Home", { altKey: true });
    expect(document.activeElement).toBe(items[0]);

    press("ArrowRight", { metaKey: true });
    expect(document.activeElement).toBe(items[3]);
  });

  it("matches chords regardless of modifier spelling and order", () => {
    const { items } = makeList(2);
    const nav = create({
      container: "#group",
      items: "button",
      useDefaultKeys: false,
      keys: { next: "ctrl+shift+p" },
    });

    nav.focusIndex(0);
    press("P", { ctrlKey: true, shiftKey: true });
    expect(document.activeElement).toBe(items[1]);
  });

  it("does not fire a chord when only part of it is held", () => {
    const { items } = makeList(2);
    const nav = create({
      container: "#group",
      items: "button",
      useDefaultKeys: false,
      keys: { next: "Ctrl+Shift+P" },
    });

    nav.focusIndex(0);
    expect(pressed("p", { ctrlKey: true })).toBe(true);
    expect(pressed("p", { shiftKey: true })).toBe(true);
    expect(document.activeElement).toBe(items[0]);
  });

  it("matches on KeyboardEvent.code when asked to", () => {
    const { items } = makeList(2);
    const nav = create({
      container: "#group",
      items: "button",
      useDefaultKeys: false,
      keys: { next: [{ code: "KeyJ" }] },
    });

    nav.focusIndex(0);
    press("j", { code: "KeyJ" });
    expect(document.activeElement).toBe(items[1]);
  });

  it("supports allowWithoutModifiers for platform-specific chords", () => {
    const { items } = makeList(3);
    const nav = create({
      container: "#group",
      items: "button",
      useDefaultKeys: false,
      keys: { next: [{ key: "k", meta: true, allowWithoutModifiers: true }] },
    });

    nav.focusIndex(0);
    press("k", { metaKey: true });
    expect(document.activeElement).toBe(items[1]);
    press("k");
    expect(document.activeElement).toBe(items[2]);
  });

  it("reports custom actions through onAction and lets the host handle them", () => {
    const { items } = makeList(3);
    const onAction = vi.fn();
    const nav = create({
      container: "#group",
      items: "button",
      keys: { duplicate: "Ctrl+D", archive: ["Ctrl+Shift+A"] },
      onAction,
    });

    nav.focusIndex(1);
    press("d", { ctrlKey: true });

    expect(onAction).toHaveBeenCalledTimes(1);
    const [action, event, element, index] = onAction.mock.calls[0]!;
    expect(action).toBe("duplicate");
    expect(element).toBe(items[1]);
    expect(index).toBe(1);
    expect(event).toBeInstanceOf(KeyboardEvent);
  });

  it("runs a custom action programmatically through perform()", () => {
    const { items } = makeList(3);
    const onAction = vi.fn();
    const nav = create({
      container: "#group",
      items: "button",
      keys: { duplicate: "Ctrl+D" },
      onAction,
    });

    nav.focusIndex(1);
    expect(nav.perform("duplicate")).toBe(true);
    expect(onAction).toHaveBeenCalledWith("duplicate", null, items[1], 1);

    expect(nav.perform("nope")).toBe(true);
  });

  it("can be re-read at runtime through update()", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", useDefaultKeys: false, keys: { next: "j" } });

    nav.focusIndex(0);
    press("ArrowDown");
    expect(document.activeElement).toBe(items[0]);

    nav.update({ keys: { next: "ArrowDown" } });
    press("ArrowDown");
    expect(document.activeElement).toBe(items[1]);
  });
});

describe("key sequences", () => {
  it("runs an action when the whole sequence lands", () => {
    const { items } = makeList(5);
    const nav = create({
      container: "#group",
      items: "button",
      sequences: [{ binding: ["g", "i"], action: "first" }],
    });

    nav.focusIndex(3);
    press("g");
    expect(document.activeElement).toBe(items[3]);
    press("i");
    expect(document.activeElement).toBe(items[0]);
  });

  it("swallows the intermediate press by default", () => {
    makeList(3);
    const nav = create({
      container: "#group",
      items: "button",
      sequences: [{ binding: ["g", "i"], action: "first" }],
    });

    nav.focusIndex(0);
    expect(pressed("g")).toBe(false);
  });

  it("keeps the intermediate press when preventDefault is false", () => {
    makeList(3);
    const nav = create({
      container: "#group",
      items: "button",
      sequences: [{ binding: ["g", "i"], action: "first", preventDefault: false }],
    });

    nav.focusIndex(0);
    expect(pressed("g")).toBe(true);
    press("i");
    expect(nav.currentIndex).toBe(0);
  });

  it("abandons a half-typed sequence", () => {
    const { items } = makeList(5);
    const nav = create({
      container: "#group",
      items: "button",
      sequences: [{ binding: ["g", "i"], action: "first" }],
    });

    nav.focusIndex(3);
    press("g");
    press("x");
    press("i");
    expect(document.activeElement).toBe(items[3]);
  });

  it("times out between presses", async () => {
    const { items } = makeList(5);
    const nav = create({
      container: "#group",
      items: "button",
      sequences: [{ binding: ["g", "i"], action: "first", timeout: 20 }],
    });

    nav.focusIndex(3);
    press("g");
    await new Promise((resolve) => setTimeout(resolve, 40));
    press("i");
    expect(document.activeElement).toBe(items[3]);
  });

  it("supports chords inside a sequence", () => {
    const { items } = makeList(4);
    const nav = create({
      container: "#group",
      items: "button",
      useDefaultKeys: false,
      sequences: [{ binding: ["Ctrl+K", "Ctrl+C"], action: "last" }],
    });

    nav.focusIndex(0);
    press("k", { ctrlKey: true });
    press("c", { ctrlKey: true });
    expect(document.activeElement).toBe(items[3]);
  });

  it("reports that the action came from a sequence", () => {
    makeList(3);
    const onAction = vi.fn();
    const nav = create({
      container: "#group",
      items: "button",
      sequences: [{ binding: ["g", "g"], action: "first" }],
      onAction,
    });

    nav.focusIndex(2);
    const seen: boolean[] = [];
    nav.on("action", ({ fromSequence }) => seen.push(fromSequence));
    press("g");
    press("g");
    expect(seen).toEqual([true]);
  });

  it("Escape clears a pending sequence", () => {
    const { items } = makeList(4);
    const nav = create({
      container: "#group",
      items: "button",
      sequences: [{ binding: ["g", "i"], action: "first" }],
    });

    nav.focusIndex(2);
    press("g");
    press("Escape");
    press("i");
    expect(document.activeElement).toBe(items[2]);
  });
});

describe("conditional handling", () => {
  it("ignores every key while when() is false", () => {
    const { items } = makeList(3);
    let open = false;
    const nav = create({ container: "#group", items: "button", when: () => open });

    nav.focusIndex(0);
    expect(pressed("ArrowDown")).toBe(true);
    expect(document.activeElement).toBe(items[0]);

    open = true;
    press("ArrowDown");
    expect(document.activeElement).toBe(items[1]);
  });

  it("can be switched off and on again", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button" });

    nav.focusIndex(0);
    nav.disable();
    expect(nav.enabled).toBe(false);
    expect(pressed("ArrowDown")).toBe(true);
    expect(document.activeElement).toBe(items[0]);

    nav.enable();
    expect(nav.enabled).toBe(true);
    press("ArrowDown");
    expect(document.activeElement).toBe(items[1]);
  });

  it("can start disabled", () => {
    const { items } = makeList(3);
    const nav = create({ container: "#group", items: "button", enabled: false });

    expect(nav.enabled).toBe(false);
    items[0]!.focus();
    expect(pressed("ArrowDown")).toBe(true);
    expect(document.activeElement).toBe(items[0]);

    nav.focusIndex(2);
    expect(document.activeElement).toBe(items[2]);
  });
});

describe("createKeyBinding", () => {
  it("fires on a chord anywhere in the document", () => {
    const handler = vi.fn();
    track(createKeyBinding("Ctrl+K", handler));

    press("k", { ctrlKey: true, target: document.body });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0]).toBeInstanceOf(KeyboardEvent);
    expect(handler.mock.calls[0]![1]).toEqual({ action: "shortcut", fromSequence: false });
  });

  it("prevents the default only when it matched", () => {
    track(createKeyBinding("Ctrl+K", () => {}));

    expect(pressed("k", { ctrlKey: true, target: document.body })).toBe(false);
    expect(pressed("j", { ctrlKey: true, target: document.body })).toBe(true);
    expect(pressed("k", { target: document.body })).toBe(true);
  });

  it("accepts several bindings", () => {
    const handler = vi.fn();
    track(createKeyBinding(["Ctrl+S", "Meta+S"], handler));

    press("s", { ctrlKey: true, target: document.body });
    press("s", { metaKey: true, target: document.body });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("does not steal bare letters from a text field, but does steal chords", () => {
    const input = document.createElement("input");
    input.type = "text";
    document.body.appendChild(input);
    input.focus();

    const letter = vi.fn();
    const chord = vi.fn();
    track(createKeyBinding("k", letter));
    track(createKeyBinding("Ctrl+K", chord));

    press("k", { target: input });
    expect(letter).not.toHaveBeenCalled();

    press("k", { ctrlKey: true, target: input });
    expect(chord).toHaveBeenCalledTimes(1);
  });

  it("can be told to fire inside text fields anyway", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const handler = vi.fn();
    track(createKeyBinding("k", handler, { allowInEditable: true }));

    press("k", { target: input });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("respects when()", () => {
    let ready = false;
    const handler = vi.fn();
    track(createKeyBinding("Ctrl+K", handler, { when: () => ready }));

    press("k", { ctrlKey: true, target: document.body });
    expect(handler).not.toHaveBeenCalled();

    ready = true;
    press("k", { ctrlKey: true, target: document.body });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("can be enabled, disabled and destroyed", () => {
    const handler = vi.fn();
    const binding = createKeyBinding("Ctrl+K", handler, { enabled: false });
    instances.push(binding);

    press("k", { ctrlKey: true, target: document.body });
    expect(handler).not.toHaveBeenCalled();

    binding.enable();
    press("k", { ctrlKey: true, target: document.body });
    expect(handler).toHaveBeenCalledTimes(1);

    binding.disable();
    press("k", { ctrlKey: true, target: document.body });
    expect(handler).toHaveBeenCalledTimes(1);

    binding.enable();
    binding.destroy();
    binding.enable();
    press("k", { ctrlKey: true, target: document.body });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("can listen on one element instead of the document", () => {
    const { container } = makeList(2);
    const outside = document.createElement("button");
    document.body.appendChild(outside);

    const handler = vi.fn();
    track(createKeyBinding("Ctrl+K", handler, { target: "#group" }));

    press("k", { ctrlKey: true, target: outside });
    expect(handler).not.toHaveBeenCalled();

    press("k", { ctrlKey: true, target: container });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("stops propagation when asked to", () => {
    const { container, items } = makeList(2);
    const outer = vi.fn();
    document.addEventListener("keydown", outer);
    track(createKeyBinding("Ctrl+K", () => {}, { target: "#group", stopPropagation: true }));

    press("k", { ctrlKey: true, target: items[0] });
    expect(outer).not.toHaveBeenCalled();

    press("j", { ctrlKey: true, target: items[0] });
    expect(outer).toHaveBeenCalledTimes(1);

    document.removeEventListener("keydown", outer);
    expect(container.id).toBe("group");
  });

  it("runs multi-key sequences", () => {
    const handler = vi.fn();
    track(createKeyBinding("Ctrl+K", handler, { sequences: [{ binding: ["g", "i"], action: "go" }] }));

    press("g", { target: document.body });
    expect(handler).not.toHaveBeenCalled();
    press("i", { target: document.body });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![1]).toEqual({ action: "go", fromSequence: true });
  });

  it("answers matches() without handling anything", () => {
    const handler = vi.fn();
    const binding = track(createKeyBinding("Ctrl+Shift+P", handler));

    const event = new KeyboardEvent("keydown", { key: "P", ctrlKey: true, shiftKey: true });
    expect(binding.matches(event)).toBe(true);
    expect(binding.matches(new KeyboardEvent("keydown", { key: "p" }))).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("useKeystra", () => {
  it("waits for a container that does not exist yet", () => {
    const handle = track(useKeystra({ items: "button" }));

    expect(handle.instance).toBeNull();
    expect(handle.container).toBeNull();

    const { items } = makeList(3);
    const instance = handle.attach("#group");

    expect(instance).not.toBeNull();
    expect(handle.instance).toBe(instance);
    expect(handle.container).toBe(items[0]!.parentElement);

    instance!.focusIndex(0);
    press("ArrowDown");
    expect(document.activeElement).toBe(items[1]);
  });

  it("ignores a selector that matches nothing", () => {
    const handle = track(useKeystra({ items: "button" }));

    expect(handle.attach("#nope")).toBeNull();
    expect(handle.instance).toBeNull();
    expect(handle.attach(null)).toBeNull();
  });

  it("creates the instance straight away when the container is in the options", () => {
    makeList(3);
    const handle = track(useKeystra({ container: "#group", items: "button" }));

    expect(handle.instance).not.toBeNull();
    handle.instance!.focusIndex(1);
    expect(handle.instance!.currentIndex).toBe(1);
  });

  it("is idempotent", () => {
    makeList(3);
    const handle = track(useKeystra({ items: "button" }));

    const first = handle.attach("#group");
    const second = handle.attach("#group");
    expect(second).toBe(first);

    handle.detach();
    handle.detach();
    expect(handle.instance).toBe(first);
  });

  it("detaches without losing the instance, and reattaches on demand", () => {
    const { items } = makeList(3);
    const handle = track(useKeystra({ items: "button" }));
    const instance = handle.attach("#group")!;

    instance.focusIndex(0);
    handle.detach();
    expect(pressed("ArrowDown")).toBe(true);
    expect(document.activeElement).toBe(items[0]);
    expect(handle.instance).toBe(instance);

    handle.attach("#group");
    press("ArrowDown");
    expect(document.activeElement).toBe(items[1]);
  });

  it("follows the element when the host swaps it out", () => {
    const { items } = makeList(2);
    const handle = track(useKeystra({ items: "button" }));
    const instance = handle.attach("#group")!;

    instance.focusIndex(0);
    press("ArrowDown");
    expect(document.activeElement).toBe(items[1]);

    const replacement = document.createElement("div");
    replacement.id = "group-2";
    document.body.appendChild(replacement);
    const fresh: HTMLElement[] = [];
    for (const label of ["a", "b", "c"]) {
      const button = document.createElement("button");
      button.textContent = label;
      button.dataset.keystraItem = "";
      replacement.appendChild(button);
      fresh.push(button);
    }

    expect(handle.attach("#group-2")).toBe(instance);
    expect(handle.container).toBe(replacement);
    expect(instance.items).toHaveLength(3);

    instance.focusIndex(0);
    press("ArrowDown");
    expect(document.activeElement).toBe(fresh[1]);
  });

  it("leaves an instance created with enabled: false disabled", () => {
    makeList(2);
    const handle = track(useKeystra({ items: "button", enabled: false }));
    const instance = handle.attach("#group")!;

    expect(instance.enabled).toBe(false);
    handle.detach();
    handle.attach("#group");
    expect(instance.enabled).toBe(false);
  });

  it("destroys the instance exactly once", () => {
    makeList(2);
    const handle = useKeystra({ items: "button" });
    const instance = handle.attach("#group")!;
    const onDestroy = vi.fn();
    instance.on("destroy", onDestroy);

    handle.destroy();
    expect(onDestroy).toHaveBeenCalledTimes(1);
    expect(handle.instance).toBeNull();

    handle.destroy();
    expect(onDestroy).toHaveBeenCalledTimes(1);
    expect(handle.attach("#group")).toBeNull();
  });
});

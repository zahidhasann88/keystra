import { describe, expect, it, vi } from "vitest";
import { KeyMatcher, keyEquals, parseKeyBinding } from "../src/core/key-matcher.js";
import { normalizeKeyEvent } from "../src/core/keyboard.js";

function ev(key: string, init: Partial<KeyboardEvent> = {}) {
  return normalizeKeyEvent(new KeyboardEvent("keydown", { key, ...init }));
}

describe("parseKeyBinding", () => {
  it("parses plain keys", () => {
    expect(parseKeyBinding("ArrowDown")).toMatchObject({ key: "ArrowDown", ctrl: false, shift: false, meta: false, alt: false });
    expect(parseKeyBinding("enter")).toMatchObject({ key: "Enter" });
    expect(parseKeyBinding(" ")).toMatchObject({ key: "Space" });
    expect(parseKeyBinding("Space")).toMatchObject({ key: "Space" });
    expect(parseKeyBinding("?")).toMatchObject({ key: "?" });
  });

  it("parses modifier chords in any order and casing", () => {
    for (const chord of ["Ctrl+Shift+P", "shift+ctrl+p", "SHIFT+Control+p", "control+shift+P"]) {
      expect(parseKeyBinding(chord)).toMatchObject({ key: "p", ctrl: true, shift: true, alt: false, meta: false });
    }
  });

  it("understands modifier aliases", () => {
    expect(parseKeyBinding("Cmd+K")).toMatchObject({ key: "K", meta: true });
    expect(parseKeyBinding("Command+K")).toMatchObject({ key: "K", meta: true });
    expect(parseKeyBinding("Super+K")).toMatchObject({ key: "K", meta: true });
    expect(parseKeyBinding("Win+K")).toMatchObject({ key: "K", meta: true });
    expect(parseKeyBinding("Option+K")).toMatchObject({ key: "K", alt: true });
    expect(parseKeyBinding("Ctl+K")).toMatchObject({ key: "K", ctrl: true });
  });

  it("treats a trailing plus as the plus key", () => {
    expect(parseKeyBinding("Ctrl++")).toMatchObject({ key: "+", ctrl: true });
    expect(parseKeyBinding("+")).toMatchObject({ key: "+" });
  });

  it("supports quoted literals", () => {
    expect(parseKeyBinding("'+'")).toMatchObject({ key: "+" });
    expect(parseKeyBinding('Ctrl+"+"')).toMatchObject({ key: "+", ctrl: true });
  });

  it("lets a bare modifier name bind the modifier itself", () => {
    expect(parseKeyBinding("Shift")).toMatchObject({ key: "Shift", shift: false });
  });

  it("accepts the object form, including layout independent codes", () => {
    expect(parseKeyBinding({ code: "KeyK", ctrl: true })).toMatchObject({ key: null, code: "KeyK", ctrl: true });
    expect(parseKeyBinding({ key: "Escape" })).toMatchObject({ key: "Escape" });
    expect(parseKeyBinding({})).toBeNull();
  });

  it("rejects empty input", () => {
    expect(parseKeyBinding("")).toBeNull();
    expect(parseKeyBinding("   ")).toBeNull();
  });
});

describe("keyEquals", () => {
  it("is case insensitive", () => {
    expect(keyEquals("k", "K")).toBe(true);
    expect(keyEquals("escape", "Escape")).toBe(true);
    expect(keyEquals("a", "b")).toBe(false);
  });
});

describe("KeyMatcher", () => {
  it("matches every arrow key, editing key and modifier combination", () => {
    const matcher = new KeyMatcher({
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
      select: ["Enter", "Space"],
      escape: "Escape",
      first: "Home",
      last: "End",
      pageUp: "PageUp",
      pageDown: "PageDown",
      tab: "Tab",
      all: "Ctrl+A",
      save: "Meta+S",
      altEnter: "Alt+Enter",
      force: "Ctrl+Shift+F",
    });

    expect(matcher.match(ev("ArrowUp"))?.actions).toEqual(["up"]);
    expect(matcher.match(ev("ArrowDown"))?.actions).toEqual(["down"]);
    expect(matcher.match(ev("ArrowLeft"))?.actions).toEqual(["left"]);
    expect(matcher.match(ev("ArrowRight"))?.actions).toEqual(["right"]);
    expect(matcher.match(ev("Enter"))?.actions).toEqual(["select"]);
    expect(matcher.match(ev(" "))?.actions).toEqual(["select"]);
    expect(matcher.match(ev("Escape"))?.actions).toEqual(["escape"]);
    expect(matcher.match(ev("Home"))?.actions).toEqual(["first"]);
    expect(matcher.match(ev("End"))?.actions).toEqual(["last"]);
    expect(matcher.match(ev("PageUp"))?.actions).toEqual(["pageUp"]);
    expect(matcher.match(ev("PageDown"))?.actions).toEqual(["pageDown"]);
    expect(matcher.match(ev("Tab"))?.actions).toEqual(["tab"]);
    expect(matcher.match(ev("a", { ctrlKey: true }))?.actions).toEqual(["all"]);
    expect(matcher.match(ev("s", { metaKey: true }))?.actions).toEqual(["save"]);
    expect(matcher.match(ev("Enter", { altKey: true }))?.actions).toEqual(["altEnter"]);
    expect(matcher.match(ev("F", { ctrlKey: true, shiftKey: true }))?.actions).toEqual(["force"]);
  });

  it("does not confuse a plain key with its modified version", () => {
    const matcher = new KeyMatcher({ all: "Ctrl+A" });
    expect(matcher.match(ev("a"))).toBeNull();
    expect(matcher.match(ev("a", { ctrlKey: true }))?.actions).toEqual(["all"]);
    expect(matcher.match(ev("a", { altKey: true }))).toBeNull();
  });

  it("does not let Shift+Tab match a plain Tab binding", () => {
    const matcher = new KeyMatcher({ next: "Tab" });
    expect(matcher.match(ev("Tab"))?.actions).toEqual(["next"]);
    expect(matcher.match(ev("Tab", { shiftKey: true }))).toBeNull();
  });

  it("matches Shift+Tab when bound explicitly", () => {
    const matcher = new KeyMatcher({ next: "Tab", previous: "Shift+Tab" });
    expect(matcher.match(ev("Tab", { shiftKey: true }))?.actions).toEqual(["previous"]);
  });

  it("returns every action bound to one chord, in binding order", () => {
    const matcher = new KeyMatcher({ right: "ArrowRight", next: "ArrowRight" });
    expect(matcher.match(ev("ArrowRight"))?.actions).toEqual(["right", "next"]);
  });

  it("matches on `code` for layout independent shortcuts", () => {
    const matcher = new KeyMatcher({ palette: { code: "KeyK", ctrl: true } });
    expect(matcher.match(ev("ł", { ctrlKey: true, code: "KeyK" }))?.actions).toEqual(["palette"]);
    expect(matcher.match(ev("k", { ctrlKey: true, code: "KeyJ" }))).toBeNull();
  });

  it("supports allowWithoutModifiers", () => {
    const matcher = new KeyMatcher({ palette: { key: "k", meta: true, allowWithoutModifiers: true } });
    expect(matcher.match(ev("k", { metaKey: true }))?.actions).toEqual(["palette"]);
    expect(matcher.match(ev("k"))?.actions).toEqual(["palette"]);
    expect(matcher.match(ev("k", { ctrlKey: true }))).toBeNull();
  });

  it("tolerates a shifted glyph for a character binding", () => {
    const matcher = new KeyMatcher({ save: "Ctrl+K" });
    expect(matcher.match(ev("k", { ctrlKey: true }))?.actions).toEqual(["save"]);
    expect(matcher.match(ev("K", { ctrlKey: true }))?.actions).toEqual(["save"]);
    expect(matcher.match(ev("K", { ctrlKey: true, shiftKey: true }))).toBeNull();
    const plain = new KeyMatcher({ letter: "k" });
    expect(plain.match(ev("k"))?.actions).toEqual(["letter"]);
    expect(plain.match(ev("K", { shiftKey: true }))?.actions).toEqual(["letter"]);
    expect(plain.match(ev("Tab", { shiftKey: true }))).toBeNull();
  });

  it("reports which actions are bound", () => {
    const matcher = new KeyMatcher({ next: "j", previous: "k", select: false });
    expect(matcher.has("next")).toBe(true);
    expect(matcher.has("select")).toBe(false);
    expect(matcher.boundActions).toEqual(["next", "previous"]);
  });

  it("ignores false, null and empty bindings", () => {
    const matcher = new KeyMatcher({ next: false, previous: null, select: [], up: "ArrowUp" } as never);
    expect(matcher.has("next")).toBe(false);
    expect(matcher.has("previous")).toBe(false);
    expect(matcher.has("select")).toBe(false);
    expect(matcher.has("up")).toBe(true);
  });

  it("replaces the whole table on loadMap", () => {
    const matcher = new KeyMatcher({ next: "ArrowDown" });
    expect(matcher.match(ev("ArrowDown"))?.actions).toEqual(["next"]);
    matcher.loadMap({ next: "j" });
    expect(matcher.match(ev("ArrowDown"))).toBeNull();
    expect(matcher.match(ev("j"))?.actions).toEqual(["next"]);
  });

  it("matches multi-key sequences", () => {
    const matcher = new KeyMatcher({}, [{ binding: ["g", "i"], action: "first" }]);
    const owner = {};
    const first = matcher.match(ev("g"), owner);
    expect(first).toMatchObject({ complete: false, fromSequence: true, actions: ["first"] });
    const second = matcher.match(ev("i"), owner);
    expect(second).toMatchObject({ complete: true, actions: ["first"] });
  });

  it("abandons a sequence when the second press is wrong", () => {
    const matcher = new KeyMatcher({}, [{ binding: ["g", "i"], action: "first" }]);
    const owner = {};
    matcher.match(ev("g"), owner);
    expect(matcher.match(ev("x"), owner)).toBeNull();
    expect(matcher.match(ev("i"), owner)).toBeNull();
  });

  it("times a sequence out", () => {
    vi.useFakeTimers();
    try {
      const matcher = new KeyMatcher({}, [{ binding: ["g", "i"], action: "first", timeout: 500 }]);
      const owner = {};
      matcher.match(ev("g"), owner);
      vi.advanceTimersByTime(600);
      expect(matcher.match(ev("i"), owner)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps sequence state separate per owner", () => {
    const matcher = new KeyMatcher({}, [{ binding: ["g", "i"], action: "first" }]);
    const a = {};
    const b = {};
    matcher.match(ev("g"), a);
    expect(matcher.match(ev("i"), b)).toBeNull();
    expect(matcher.match(ev("i"), a)).toBeNull();
  });

  it("matches sequences with modifiers", () => {
    const matcher = new KeyMatcher({}, [{ binding: ["Ctrl+K", "Ctrl+C"], action: "copyPath" }]);
    const owner = {};
    matcher.match(ev("k", { ctrlKey: true }), owner);
    expect(matcher.match(ev("c", { ctrlKey: true }), owner)?.actions).toEqual(["copyPath"]);
  });

  it("does not need an owner when only one instance uses the matcher", () => {
    const matcher = new KeyMatcher({}, [{ binding: ["g", "i"], action: "first" }]);
    matcher.match(ev("g"));
    expect(matcher.match(ev("i"))?.actions).toEqual(["first"]);
  });

  it("ignores malformed sequences", () => {
    const matcher = new KeyMatcher({}, [
      { binding: ["g"], action: "tooShort" },
      { binding: [], action: "empty" },
      { binding: ["g", "i"], action: "" },
    ] as never);
    expect(matcher.match(ev("g"), {})).toBeNull();
    expect(matcher.size).toBe(0);
  });

  it("clears timers and tables on dispose", () => {
    const matcher = new KeyMatcher({ next: "ArrowDown" }, [{ binding: ["g", "i"], action: "first" }]);
    matcher.match(ev("g"), {});
    matcher.dispose();
    expect(matcher.size).toBe(0);
    expect(matcher.match(ev("ArrowDown"))).toBeNull();
  });
});

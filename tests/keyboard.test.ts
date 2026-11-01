import { describe, expect, it } from "vitest";
import {
  codeToKey,
  describeEvent,
  formatKeyCombo,
  isModifierKey,
  isPrintableKey,
  normalizeKeyName,
  normalizeKeyEvent,
} from "../src/core/keyboard.js";

function event(key: string, init: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, ...init });
}

describe("normalizeKeyName", () => {
  it("maps legacy and vendor specific names to modern ones", () => {
    expect(normalizeKeyName("Spacebar")).toBe("Space");
    expect(normalizeKeyName(" ")).toBe("Space");
    expect(normalizeKeyName("Esc")).toBe("Escape");
    expect(normalizeKeyName("Left")).toBe("ArrowLeft");
    expect(normalizeKeyName("Up")).toBe("ArrowUp");
    expect(normalizeKeyName("Del")).toBe("Delete");
    expect(normalizeKeyName("Return")).toBe("Enter");
    expect(normalizeKeyName("Windows")).toBe("Meta");
    expect(normalizeKeyName("Cmd")).toBe("Meta");
    expect(normalizeKeyName("Option")).toBe("Alt");
    expect(normalizeKeyName("Control")).toBe("Control");
  });

  it("keeps canonical names exactly as the DOM reports them", () => {
    for (const key of [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Enter",
      "Escape",
      "Tab",
      "Home",
      "End",
      "PageUp",
      "PageDown",
      "Backspace",
      "Delete",
    ]) {
      expect(normalizeKeyName(key)).toBe(key);
    }
  });

  it("normalises the casing of named keys without touching single characters", () => {
    expect(normalizeKeyName("escape")).toBe("Escape");
    expect(normalizeKeyName("PAGEUP")).toBe("PageUp");
    expect(normalizeKeyName("arrowdown")).toBe("ArrowDown");
    expect(normalizeKeyName("a")).toBe("a");
    expect(normalizeKeyName("A")).toBe("A");
    expect(normalizeKeyName("?")).toBe("?");
  });

  it("passes unknown names through untouched", () => {
    expect(normalizeKeyName("AudioVolumeUp")).toBe("AudioVolumeUp");
    expect(normalizeKeyName("")).toBe("");
  });
});

describe("isPrintableKey", () => {
  it("accepts characters and rejects control keys", () => {
    expect(isPrintableKey("a")).toBe(true);
    expect(isPrintableKey("7")).toBe(true);
    expect(isPrintableKey("?")).toBe(true);
    expect(isPrintableKey("é")).toBe(true);
    expect(isPrintableKey("ArrowDown")).toBe(false);
    expect(isPrintableKey("Enter")).toBe(false);
    expect(isPrintableKey("F5")).toBe(false);
    expect(isPrintableKey("Shift")).toBe(false);
    expect(isPrintableKey("")).toBe(false);
  });
});

describe("isModifierKey", () => {
  it("recognises the four modifiers", () => {
    expect(isModifierKey("Shift")).toBe(true);
    expect(isModifierKey("Control")).toBe(true);
    expect(isModifierKey("Alt")).toBe(true);
    expect(isModifierKey("Meta")).toBe(true);
    expect(isModifierKey("CapsLock")).toBe(false);
    expect(isModifierKey("a")).toBe(false);
  });
});

describe("normalizeKeyEvent", () => {
  it("reports modifiers and derived flags", () => {
    const normalized = normalizeKeyEvent(event("k", { ctrlKey: true, shiftKey: true }));
    expect(normalized).toMatchObject({ key: "k", ctrl: true, shift: true, alt: false, meta: false });
    expect(normalized.isPlain).toBe(false);
    expect(normalized.isPrintable).toBe(false);
    expect(normalized.originalEvent).toBeInstanceOf(KeyboardEvent);
  });

  it("treats a plain character as printable", () => {
    const normalized = normalizeKeyEvent(event("s"));
    expect(normalized.isPrintable).toBe(true);
    expect(normalized.isPlain).toBe(true);
  });

  it("does not treat Shift as a blocking modifier for printability", () => {
    expect(normalizeKeyEvent(event("S", { shiftKey: true })).isPrintable).toBe(true);
    expect(normalizeKeyEvent(event("?", { shiftKey: true })).isPrintable).toBe(true);
  });

  it("normalises the space bar", () => {
    expect(normalizeKeyEvent(event(" ")).key).toBe("Space");
    expect(normalizeKeyEvent(event("Spacebar")).key).toBe("Space");
  });

  it("falls back to `code` when the key is unidentified", () => {
    const normalized = normalizeKeyEvent(event("Unidentified", { code: "KeyK" }));
    expect(normalized.key).toBe("K");
  });

  it("exposes repeat state", () => {
    expect(normalizeKeyEvent(event("ArrowDown", { repeat: true })).repeat).toBe(true);
    expect(normalizeKeyEvent(event("ArrowDown")).repeat).toBe(false);
  });
});

describe("codeToKey", () => {
  it("maps layout independent codes to characters", () => {
    expect(codeToKey("KeyA")).toBe("A");
    expect(codeToKey("Digit3")).toBe("3");
    expect(codeToKey("Space")).toBe("Space");
    expect(codeToKey("NumpadEnter")).toBe("Enter");
    expect(codeToKey("Numpad7")).toBe("7");
    expect(codeToKey("Minus")).toBe("-");
    expect(codeToKey("ArrowLeft")).toBe("ArrowLeft");
    expect(codeToKey("")).toBe("");
    expect(codeToKey("SomethingOdd")).toBe("");
  });
});

describe("formatKeyCombo / describeEvent", () => {
  it("prints modifiers in a stable order", () => {
    expect(formatKeyCombo("p", { ctrl: true, shift: true })).toBe("Ctrl+Shift+p");
    expect(formatKeyCombo("k", { meta: true })).toBe("Meta+k");
    expect(formatKeyCombo("k", { meta: true, ctrl: true, alt: true, shift: true })).toBe("Ctrl+Alt+Shift+Meta+k");
    expect(formatKeyCombo("Enter")).toBe("Enter");
  });

  it("describes a live event", () => {
    expect(describeEvent(event("ArrowDown"))).toBe("ArrowDown");
    expect(describeEvent(event("a", { altKey: true }))).toBe("Alt+a");
  });
});

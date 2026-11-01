import type { NormalizedKeyEvent } from "../types/index.js";

const KEY_ALIASES: Readonly<Record<string, string>> = {
  spacebar: "Space",
  " ": "Space",
  esc: "Escape",
  del: "Delete",
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
  down: "ArrowDown",
  multiply: "*",
  add: "+",
  subtract: "-",
  divide: "/",
  decimal: ".",
  windows: "Meta",
  cmd: "Meta",
  command: "Meta",
  option: "Alt",
  control: "Control",
  return: "Enter",
  cr: "Enter",
  pageup: "PageUp",
  pagedown: "PageDown",
  "page up": "PageUp",
  "page down": "PageDown",
};

const CANONICAL = new Set<string>([
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "enter",
  "escape",
  "tab",
  "space",
  "home",
  "end",
  "pageup",
  "pagedown",
  "backspace",
  "delete",
  "insert",
  "shift",
  "control",
  "alt",
  "meta",
  "capslock",
  "contextmenu",
  "f1",
  "f2",
  "f3",
  "f4",
  "f5",
  "f6",
  "f7",
  "f8",
  "f9",
  "f10",
  "f11",
  "f12",
  "f13",
  "f14",
  "f15",
  "f16",
  "f17",
  "f18",
  "f19",
  "f20",
  "f21",
  "f22",
  "f23",
  "f24",
  "printscreen",
  "scrolllock",
  "pause",
  "unidentified",
]);

export function normalizeKeyName(key: string): string {
  if (!key) return "";
  const lower = key.toLowerCase();
  const alias = KEY_ALIASES[lower];
  if (alias !== undefined) return alias;
  if (key.length === 1) return key;
  if (CANONICAL.has(lower)) return canonicalCase(lower);
  return key;
}

function canonicalCase(lower: string): string {
  switch (lower) {
    case "arrowup":
      return "ArrowUp";
    case "arrowdown":
      return "ArrowDown";
    case "arrowleft":
      return "ArrowLeft";
    case "arrowright":
      return "ArrowRight";
    case "pageup":
      return "PageUp";
    case "pagedown":
      return "PageDown";
    case "capslock":
      return "CapsLock";
    case "contextmenu":
      return "ContextMenu";
    case "printscreen":
      return "PrintScreen";
    case "scrolllock":
      return "ScrollLock";
    case "unidentified":
      return "Unidentified";
    default:
      return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
}

const NON_PRINTABLE = new Set<string>([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "Tab",
  "Enter",
  "Escape",
  "Backspace",
  "Delete",
  "Insert",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ContextMenu",
  "PrintScreen",
  "ScrollLock",
  "Pause",
  "Unidentified",
]);

export function isPrintableKey(key: string): boolean {
  if (!key) return false;
  if (key.length === 1) return true;
  if (NON_PRINTABLE.has(key)) return false;
  if (/^F\d{1,2}$/.test(key)) return false;
  if (/^(Numpad|NumLock)/.test(key)) return false;
  return false;
}

export function isModifierKey(key: string): boolean {
  return key === "Shift" || key === "Control" || key === "Alt" || key === "Meta";
}

export function normalizeKeyEvent(event: KeyboardEvent): NormalizedKeyEvent {
  let key = normalizeKeyName(event.key ?? "");
  if (key === "Unidentified" || key === "") {
    const fromCode = codeToKey(event.code);
    if (fromCode) key = fromCode;
  }
  const ctrl = event.ctrlKey === true;
  const alt = event.altKey === true;
  const shift = event.shiftKey === true;
  const meta = event.metaKey === true;
  return {
    key,
    code: event.code ?? "",
    ctrl,
    alt,
    shift,
    meta,
    isPlain: !ctrl && !alt && !meta,
    isPrintable: isPrintableKey(key) && !ctrl && !alt && !meta,
    repeat: event.repeat === true,
    shiftKey: shift,
    originalEvent: event,
  };
}

export function codeToKey(code: string): string {
  if (!code) return "";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return code;
  if (code === "NumpadEnter") return "Enter";
  if (code.startsWith("Numpad")) {
    const rest = code.slice(6);
    if (/^\d$/.test(rest)) return rest;
    if (rest === "Add") return "+";
    if (rest === "Subtract") return "-";
    if (rest === "Multiply") return "*";
    if (rest === "Divide") return "/";
    if (rest === "Decimal") return ".";
    return `Numpad${rest}`;
  }
  switch (code) {
    case "Space":
      return "Space";
    case "Enter":
    case "NumpadEnter":
      return "Enter";
    case "Escape":
      return "Escape";
    case "Tab":
      return "Tab";
    case "Backspace":
      return "Backspace";
    case "Delete":
      return "Delete";
    case "Minus":
      return "-";
    case "Equal":
      return "=";
    case "Comma":
      return ",";
    case "Period":
      return ".";
    case "Slash":
      return "/";
    case "Backslash":
      return "\\";
    case "Semicolon":
      return ";";
    case "Quote":
      return "'";
    case "BracketLeft":
      return "[";
    case "BracketRight":
      return "]";
    case "Backquote":
      return "`";
    default:
      return "";
  }
}

export function formatKeyCombo(
  key: string,
  modifiers: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {},
): string {
  const parts: string[] = [];
  if (modifiers.ctrl) parts.push("Ctrl");
  if (modifiers.alt) parts.push("Alt");
  if (modifiers.shift) parts.push("Shift");
  if (modifiers.meta) parts.push("Meta");
  if (key) parts.push(key);
  return parts.join("+");
}

export function describeEvent(event: KeyboardEvent): string {
  const normalized = normalizeKeyEvent(event);
  return formatKeyCombo(normalized.key, normalized);
}

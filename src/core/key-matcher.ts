import type {
  KeyAction,
  KeyBinding,
  KeyBindingInput,
  KeyMap,
  KeySequenceInput,
  KeySequenceOptions,
  NormalizedKeyEvent,
  ParsedKeyBinding,
} from "../types/index.js";
import { normalizeKeyName } from "./keyboard.js";

const MODIFIER_ALIASES: Readonly<Record<string, "ctrl" | "alt" | "shift" | "meta">> = {
  ctrl: "ctrl",
  ctl: "ctrl",
  control: "ctrl",
  alt: "alt",
  option: "alt",
  opt: "alt",
  shift: "shift",
  meta: "meta",
  cmd: "meta",
  command: "meta",
  super: "meta",
  win: "meta",
  windows: "meta",
};

function tokenize(chord: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < chord.length; i++) {
    const char = chord[i]!;
    if (char === '"' || char === "'") {
      quoted = !quoted;
      continue;
    }
    if (char === "+" && !quoted) {
      if (i === chord.length - 1) {
        tokens.push("+");
        current = "";
        continue;
      }
      if (current !== "") tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current !== "") tokens.push(current);
  return tokens;
}

export function parseKeyBinding(binding: KeyBinding): ParsedKeyBinding | null {
  if (binding == null) return null;

  let key: string | null = null;
  let code: string | null = null;
  let ctrl = false;
  let alt = false;
  let shift = false;
  let meta = false;
  let allowWithoutModifiers = false;

  if (typeof binding === "object") {
    if (binding.key) key = normalizeKeyName(String(binding.key));
    if (binding.code) code = String(binding.code);
    ctrl = binding.ctrl === true;
    alt = binding.alt === true;
    shift = binding.shift === true;
    meta = binding.meta === true;
    allowWithoutModifiers = binding.allowWithoutModifiers === true;
    if (!key && !code) return null;
  } else {
    const raw = String(binding);
    const trimmed = raw.trim();
    if (trimmed === "" && raw !== " ") return null;
    const chord = raw === " " ? " " : trimmed;
    if (!chord) return null;
    const tokens = tokenize(chord);
    if (tokens.length === 0) return null;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!;
      const modifier = MODIFIER_ALIASES[token.toLowerCase()];
      if (modifier && i < tokens.length - 1) {
        if (modifier === "ctrl") ctrl = true;
        else if (modifier === "alt") alt = true;
        else if (modifier === "shift") shift = true;
        else meta = true;
        continue;
      }
      key = normalizeKeyName(token);
    }
    if (!key) return null;
    if (shift && key.length === 1) key = key.toLowerCase();
  }

  return {
    key,
    code,
    ctrl,
    alt,
    shift,
    meta,
    allowWithoutModifiers,
    id: bindingId(key, code, ctrl, alt, shift, meta),
  };
}

function bindingId(
  key: string | null,
  code: string | null,
  ctrl: boolean,
  alt: boolean,
  shift: boolean,
  meta: boolean,
): string {
  const flags = (ctrl ? "c" : "") + (alt ? "a" : "") + (shift ? "s" : "") + (meta ? "m" : "");
  const main = code ? `#${code.toLowerCase()}` : (key ?? "").toLowerCase();
  return flags ? `${flags}:${main}` : main;
}

function toArray(input: KeyBindingInput | false | null | undefined): readonly KeyBinding[] {
  if (input == null || input === false) return [];
  return Array.isArray(input) ? (input as readonly KeyBinding[]) : [input as KeyBinding];
}

export interface MatchResult {
  readonly actions: readonly KeyAction[];
  readonly binding: ParsedKeyBinding;
  readonly fromSequence: boolean;
  readonly complete: boolean;
  readonly preventDefault: boolean;
}

interface Entry {
  readonly actions: KeyAction[];
  readonly binding: ParsedKeyBinding;
}

interface SequenceEntry {
  readonly steps: ParsedKeyBinding[];
  readonly action: KeyAction;
  readonly timeout: number;
  readonly preventDefault: boolean;
}

export class KeyMatcher {
  private readonly byId = new Map<string, Entry>();
  private readonly loose: Entry[] = [];
  private readonly actions = new Set<KeyAction>();
  private readonly sequences: SequenceEntry[] = [];

  private sequenceIndex = 0;
  private sequenceOwner: object | null = null;
  private sequenceTimer: ReturnType<typeof setTimeout> | null = null;
  private sequenceCandidates: SequenceEntry[] = [];

  constructor(map: KeyMap = {}, sequences: readonly KeySequenceInput[] = []) {
    this.loadMap(map);
    this.loadSequences(sequences);
  }

  loadMap(map: KeyMap): void {
    this.byId.clear();
    this.loose.length = 0;
    this.actions.clear();

    for (const action of Object.keys(map)) {
      for (const raw of toArray(map[action])) {
        const binding = parseKeyBinding(raw);
        if (!binding) continue;
        this.actions.add(action);
        let entry = this.byId.get(binding.id);
        if (!entry || entry.binding.id !== binding.id) {
          entry = { actions: [], binding };
          this.byId.set(binding.id, entry);
          if (binding.allowWithoutModifiers || binding.code) this.loose.push(entry);
        }
        if (entry.actions.indexOf(action) === -1) entry.actions.push(action);
      }
    }
  }

  loadSequences(sequences: readonly KeySequenceInput[]): void {
    this.resetSequence();
    this.sequences.length = 0;
    for (const options of sequences) {
      const normalized = normalizeSequence(options);
      if (!normalized) continue;
      const steps: ParsedKeyBinding[] = [];
      let valid = true;
      for (const raw of normalized.binding) {
        const parsed = parseKeyBinding(raw);
        if (!parsed) {
          valid = false;
          break;
        }
        steps.push(parsed);
      }
      if (!valid) continue;
      this.sequences.push({
        steps,
        action: normalized.action,
        timeout: normalized.timeout ?? 1000,
        preventDefault: normalized.preventDefault !== false,
      });
    }
  }

  has(action: KeyAction): boolean {
    return this.actions.has(action);
  }

  get boundActions(): readonly KeyAction[] {
    return Array.from(this.actions);
  }

  get size(): number {
    return this.byId.size + this.sequences.length;
  }

  match(event: NormalizedKeyEvent, owner?: object): MatchResult | null {
    if (this.sequences.length > 0) {
      const sequence = this.matchSequence(event, owner);
      if (sequence) return sequence;
    }

    const ids = candidateIds(event);
    for (let i = 0; i < ids.length; i++) {
      const entry = this.byId.get(ids[i]!);
      if (entry && matchesBinding(entry.binding, event)) {
        return { actions: entry.actions, binding: entry.binding, fromSequence: false, complete: true, preventDefault: true };
      }
    }

    for (let i = 0; i < this.loose.length; i++) {
      const entry = this.loose[i]!;
      if (matchesBinding(entry.binding, event)) {
        return { actions: entry.actions, binding: entry.binding, fromSequence: false, complete: true, preventDefault: true };
      }
    }
    return null;
  }

  resetSequence(): void {
    this.sequenceIndex = 0;
    this.sequenceCandidates = [];
    this.clearSequenceTimer();
  }

  dispose(): void {
    this.resetSequence();
    this.byId.clear();
    this.loose.length = 0;
    this.actions.clear();
    this.sequences.length = 0;
  }

  private matchSequence(event: NormalizedKeyEvent, owner?: object): MatchResult | null {
    if (owner && this.sequenceOwner && this.sequenceOwner !== owner) this.resetSequence();
    if (owner) this.sequenceOwner = owner;

    const pending = this.sequenceCandidates.length > 0;
    const step = this.sequenceIndex;
    const pool = pending ? this.sequenceCandidates : this.sequences;
    const fitting = pool.filter((sequence) => {
      const binding = sequence.steps[step];
      return binding !== undefined && matchesBinding(binding, event);
    });
    if (fitting.length === 0) {
      if (!pending) return null;
      this.resetSequence();
      return this.matchSequence(event, owner);
    }

    const done = fitting.find((sequence) => sequence.steps.length === step + 1);
    const lead = done ?? fitting[0]!;
    const result: MatchResult = {
      actions: [lead.action],
      binding: lead.steps[step]!,
      fromSequence: true,
      complete: done !== undefined,
      preventDefault: lead.preventDefault,
    };
    if (done) {
      this.resetSequence();
    } else {
      this.sequenceCandidates = fitting;
      this.sequenceIndex = step + 1;
      this.armSequenceTimer(lead.timeout);
    }
    return result;
  }

  private armSequenceTimer(timeout: number): void {
    this.clearSequenceTimer();
    if (typeof setTimeout !== "function") return;
    this.sequenceTimer = setTimeout(() => this.resetSequence(), timeout);
  }

  private clearSequenceTimer(): void {
    if (this.sequenceTimer !== null) {
      clearTimeout(this.sequenceTimer);
      this.sequenceTimer = null;
    }
  }
}

const SHIFT_DISTINCT_KEYS = new Set(["tab"]);

function shiftDistinct(key: string): boolean {
  return SHIFT_DISTINCT_KEYS.has(key.toLowerCase());
}

function makeId(key: string, ctrl: boolean, alt: boolean, shift: boolean, meta: boolean): string {
  const flags = (ctrl ? "c" : "") + (alt ? "a" : "") + (shift ? "s" : "") + (meta ? "m" : "");
  return flags ? `${flags}:${key}` : key;
}

function candidateIds(event: NormalizedKeyEvent): string[] {
  const { ctrl, alt, shift, meta } = event;
  const key = event.key;
  const lower = key.toLowerCase();
  const ids = [makeId(lower, ctrl, alt, shift, meta)];
  const singleChar = key.length === 1;

  const noShift = shift && (singleChar || !shiftDistinct(lower))
    ? makeId(lower, ctrl, alt, false, meta)
    : null;
  if (noShift) ids.push(noShift);

  if (singleChar && lower !== key) {
    ids.push(makeId(key, ctrl, alt, shift, meta));
    if (noShift) ids.push(makeId(key, ctrl, alt, false, meta));
  }
  return ids;
}

function matchesBinding(binding: ParsedKeyBinding, event: NormalizedKeyEvent): boolean {
  if (binding.code) {
    if (binding.code.toLowerCase() !== event.code.toLowerCase()) return false;
  } else if (binding.key) {
    if (!keyEquals(binding.key, event.key)) return false;
  } else {
    return false;
  }

  if (binding.allowWithoutModifiers && !event.ctrl && !event.alt && !event.meta) return true;
  if (binding.ctrl !== event.ctrl) return false;
  if (binding.alt !== event.alt) return false;
  if (binding.meta !== event.meta) return false;

  if (binding.shift !== event.shift) {
    const named = binding.key ?? "";
    const singleChar = named.length === 1;
    if (event.shift && !binding.shift) {
      if (shiftDistinct(named)) return false;
      if (/^[a-z]$/i.test(named) && (event.ctrl || event.alt || event.meta)) return false;
    } else {
      if (!singleChar) return false;
    }
  }
  return true;
}

export function keyEquals(bindingKey: string, eventKey: string): boolean {
  if (bindingKey === eventKey) return true;
  return bindingKey.toLowerCase() === eventKey.toLowerCase();
}

function normalizeSequence(input: KeySequenceInput): KeySequenceOptions | null {
  if (!input || !input.binding || input.binding.length < 2 || !input.action) return null;
  return input;
}

export function createKeyMatcher(map: KeyMap = {}, sequences: readonly KeySequenceInput[] = []): KeyMatcher {
  return new KeyMatcher(map, sequences);
}

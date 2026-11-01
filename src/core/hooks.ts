import type {
  KeyAction,
  KeyBindingHandle,
  KeyBindingInput,
  KeyBindingOptions,
  KeystraHandle,
  KeystraInstance,
  HookOptions,
} from "../types/index.js";
import { isEditableTarget, resolveElement, resolveEventTarget } from "../utils/dom.js";
import { EventManager } from "./event-manager.js";
import { createKeystra } from "./engine.js";
import { KeyMatcher, type MatchResult } from "./key-matcher.js";
import { normalizeKeyEvent } from "./keyboard.js";

function resolveContainer(target: HookOptions["container"]): Element | null {
  return resolveElement<Element>(target, typeof document !== "undefined" ? document : null);
}

export function useKeystra(options: HookOptions = {}): KeystraHandle {
  let stored: HookOptions = { ...options };
  let instance: KeystraInstance<HTMLElement> | null = null;
  let container: Element | null = resolveContainer(stored.container);
  let detached = false;
  let resumeOnAttach = false;
  let destroyed = false;

  const handle: KeystraHandle = {
    get instance() {
      return instance;
    },
    get container() {
      return container;
    },

    attach(target) {
      if (destroyed) return null;
      const element = resolveContainer(target);
      if (!element) return instance;

      if (!instance) {
        container = element;
        instance = createKeystra<HTMLElement>({ ...stored, container: element });
        return instance;
      }

      if (element !== container) {
        container = element;
        instance.update({ container: element });
      }
      if (detached) {
        detached = false;
        if (resumeOnAttach) instance.enable();
        resumeOnAttach = false;
      }
      return instance;
    },

    detach() {
      if (!instance || detached) return;
      resumeOnAttach = instance.enabled;
      detached = true;
      instance.disable();
      container = null;
    },

    destroy() {
      destroyed = true;
      instance?.destroy();
      instance = null;
      container = null;
      detached = false;
      resumeOnAttach = false;
    },
  };

  if (container) handle.attach(container);

  return handle;
}

const SHORTCUT_ACTION: KeyAction = "shortcut";

export interface KeyBindingInfo {
  readonly action: KeyAction;
  readonly fromSequence: boolean;
}

export type KeyBindingHandler = (event: KeyboardEvent, info: KeyBindingInfo) => void;

function isChord(match: MatchResult): boolean {
  const binding = match.binding;
  return binding.ctrl === true || binding.alt === true || binding.meta === true;
}

export function createKeyBinding(
  binding: KeyBindingInput,
  handler: KeyBindingHandler,
  options: KeyBindingOptions = {},
): KeyBindingHandle {
  const matcher = new KeyMatcher({ [SHORTCUT_ACTION]: binding }, options.sequences ?? []);
  const events = new EventManager();
  const capture = options.capture === true;
  const shouldPrevent = options.preventDefault !== false;
  const shouldStop = options.stopPropagation === true;
  const allowInEditable = options.allowInEditable === true;
  const editableSelector = options.editableSelector ?? null;

  let disposer: (() => void) | null = null;
  let destroyed = false;

  function target(): EventTarget | null {
    const explicit = resolveEventTarget(options.target);
    if (explicit) return explicit;
    return typeof document !== "undefined" ? document : null;
  }

  function onKeyDown(rawEvent: Event): void {
    if (destroyed) return;
    if (options.when && !options.when()) return;

    const event = rawEvent as KeyboardEvent;
    const match = matcher.match(normalizeKeyEvent(event), handle);
    const editable = !allowInEditable && isEditableTarget(event.target, editableSelector);

    if (!match) return;
    if (!match.complete) {
      if (match.preventDefault && shouldPrevent && !(editable && !isChord(match))) event.preventDefault();
      return;
    }
    if (editable && !isChord(match)) return;

    if (shouldPrevent && match.preventDefault !== false) event.preventDefault();
    if (shouldStop) event.stopPropagation();
    handler(event, { action: match.actions[0] ?? SHORTCUT_ACTION, fromSequence: match.fromSequence });
  }

  const handle: KeyBindingHandle = {
    enable() {
      if (destroyed || disposer) return;
      const listenOn = target();
      if (!listenOn) return;
      disposer = events.add(listenOn, "keydown", onKeyDown, { capture, passive: false });
    },

    disable() {
      if (!disposer) return;
      disposer();
      disposer = null;
      matcher.resetSequence();
    },

    destroy() {
      destroyed = true;
      handle.disable();
      matcher.dispose();
      events.dispose();
    },

    matches(event: KeyboardEvent): boolean {
      const match = matcher.match(normalizeKeyEvent(event), handle);
      return match !== null && match.complete;
    },
  };

  if (options.enabled !== false) handle.enable();
  return handle;
}

# Keystra

Framework-independent keyboard navigation, focus and selection for DOM interfaces. Keystra is an interaction engine, not a component library: you supply markup, styles, accessible names and application behavior. It has no runtime dependencies and ships ESM, CommonJS and TypeScript declarations.

## Install

```sh
npm install keystra
```

## Quick start

```html
<div id="actions" aria-label="Actions">
  <button data-keystra-item>Copy</button>
  <button data-keystra-item>Move</button>
  <button data-keystra-item disabled>Delete</button>
</div>
```

```ts
import { createKeystra } from 'keystra';

const nav = createKeystra({
  container: '#actions',
  mode: 'vertical',
  loop: true,
  onFocus: (element, index) => console.log('focus', index, element),
  onSelect: (element) => console.log('activate', element),
});
nav.focusFirst();
// When the UI is removed:
nav.destroy();
```

Items default to `[data-keystra-item]`; set `items` to a selector or resolver. The engine delegates events to its container, skips disabled and hidden items, and manages roving tabindex by default. Tab is not intercepted by default. It does not create UI or style selection.

Enter and Space are consumed only when something acts on them: `onSelect`, `onAction`, a selection manager or a pattern. Otherwise links and buttons keep their native activation. Escape is likewise left to the surrounding page, such as a dialog, unless `onEscape`, `onAction` or a pattern handles it. Subscribing with `nav.on(...)` does not count, so call `preventDefault()` on the event yourself if you need to.

## Core API

`createKeystra(options)` returns an instance with `next()`, `previous()`, `focusFirst()`, `focusLast()`, `focusIndex(index)`, `focusElement(element)`, `move(direction)`, `perform(action)`, `refresh()`, `enable()`, `disable()`, `update(...)`, `restoreFocus()` and `destroy()`. Read `items`, `activeElement`, `activeIndex`, and `currentIndex`. `activeIndex` normally reflects DOM focus, while `currentIndex` retains the navigation cursor when focus leaves. With `activeDescendant`, focus remains on its owner and the cursor is exposed as the active index.

`selection: { enabled: true, mode: 'multiple' }` enables state independent of styling. Use `nav.selection` for `select`, `toggle`, `selectRange`, `selectAll`, `clear`, and `selected`; set `aria`, `attribute`, or `selectedClass` in selection options only if the widget needs them. Supported modes are `single`, `multiple`, `range`, and `none`.

Events can be subscribed with `nav.on('action', handler)` and removed with `nav.off(...)`. Options include `onFocus`, `onSelect`, `onAction`, `onEscape` and `onRefresh`. For dynamic items call `refresh()` after a change, or set `observe: true` to watch mutations; otherwise navigation revalidates the item collection lazily. `add`, `remove`, and `setItems` allow explicit registration. `update` supports `keys`, `loop`, `mode`, `columns`, `pageSize`, `enabled`, and `container`.

## Navigation and keys

Modes include `vertical` (default), `horizontal`, `sequential`, `grid`, `directional`, and `custom`. Grid can use `columns` to avoid geometry reads; directional navigation and a grid without columns use element geometry. `loop` controls wraparound. Supply `strategy(context)` to replace the built-in strategy; return an item index or `null` to decline movement.

```ts
const nav = createKeystra({
  container: '#actions',
  keys: { next: 'j', previous: 'k', first: 'Ctrl+Home' },
  sequences: [{ binding: ['g', 'g'], action: 'first' }],
  onAction: (action, event, element, index) => {
    // Custom action names are forwarded here.
  },
});
```

Key maps override individual actions; `false` removes an action, and `useDefaultKeys: false` disables the whole default map. Modifiers, `KeyboardEvent.code`, sequences and custom actions are supported. Binding Tab or overriding keys in editable fields is opt-in. `createKeyBinding('Ctrl+K', handler)` provides a document-level shortcut with `disable`, `enable`, and `destroy`.

## Patterns

`createTabs`, `createMenu`, `createDropdown`, `createList`, `createGrid`, `createTree`, `createCommandPalette`, and `createRovingFocus` provide pattern-specific defaults. For example:

```ts
import { createTabs } from 'keystra/patterns';
const tabs = createTabs({ container: '#tabs', items: '[role="tab"]' });
// Later: tabs.activate(1); tabs.destroy();
```

Menus and dropdowns remove a `hidden` attribute on open and restore it on close; pass `toggleHidden: false` to control visibility yourself. Pattern defaults can fill in missing ARIA roles and state; pass `aria: false` where supported to manage those yourself. Appropriate markup, roles, names, relationships and widget behavior remain the application's responsibility. Follow the [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) for the specific pattern and test with real browsers and assistive technology. A grid should have valid row/cell structure. For a combobox, `activeDescendant` keeps DOM focus on the input while moving its virtual cursor; ensure the active item has the proper ownership relationship. A command palette's search field should sit outside the listbox, so when it lives inside `container`, point `list` at the element that holds the results.

## TypeScript and frameworks

```ts
import { createKeystra, type KeystraOptions } from 'keystra';
const options: KeystraOptions<HTMLButtonElement> = {
  container: '#actions', items: 'button', loop: true,
};
const nav = createKeystra<HTMLButtonElement>(options);
```

Keystra only needs a DOM element, so every framework integration has the same shape: create an instance when the element is mounted and destroy it on unmount. These examples show that lifecycle; they have not been run inside each framework.

```tsx
// React
function Actions() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const nav = createKeystra({ container: ref.current, items: 'button' });
    return () => nav.destroy();
  }, []);
  return <div ref={ref}>...</div>;
}
```

```ts
// Vue, in <script setup>
const root = ref<HTMLElement>();
let nav: KeystraInstance;
onMounted(() => { nav = createKeystra({ container: root.value, items: 'button' }); });
onBeforeUnmount(() => nav.destroy());
```

```ts
// Svelte
let root: HTMLElement;
onMount(() => {
  const nav = createKeystra({ container: root, items: 'button' });
  return () => nav.destroy();
});
```

```ts
// Angular
ngAfterViewInit() { this.nav = createKeystra({ container: this.root.nativeElement, items: 'button' }); }
ngOnDestroy() { this.nav?.destroy(); }
```

## Cleanup and lifecycle

`destroy()` removes every listener and observer and puts `tabindex` and `aria-activedescendant` back as they were. Call it once, when the UI goes away; the instance cannot be reused. `disable()` and `enable()` pause an instance and resume it.

The `useKeystra` helper suits an element that does not exist yet: `attach(element)` creates the instance on first use, `detach()` stops listening and allows a later `attach`, and `destroy()` is permanent. Despite the name it is not a React hook and is safe to call anywhere. When reusing a handle in development, account for framework lifecycle replay.

Groups can be nested. Items inside an inner group's container belong to that group, even when the outer selector matches them, and keys the inner group does not bind bubble to the outer one.

## Accessibility and browser support

Keystra does not make arbitrary markup accessible automatically. Supply valid native elements or appropriate ARIA, accessible labels and state; preserve visible focus and check keyboard behavior with screen readers. Native behavior is preserved for unmatched keys; configure bindings carefully, particularly for text inputs. A chord does not claim a longer one: `Ctrl+S` ignores `Ctrl+Shift+S`. Hidden items are detected with `checkVisibility()`, so stylesheet changes are seen on the next key press without `refresh()`. Keystra's focus behavior is tested in Chrome only, and it has not been tested with screen readers; validate both in your target environments.

Targets modern browsers with ES2020, DOM and standard event APIs; optional mutation observation needs `MutationObserver`. Importing modules in Node does not require DOM globals, but interaction requires a DOM. Working on Keystra itself needs Node 22.12+, because of Vitest 5.

## Size and benchmarks

`npm run size` measured these consumer bundles. Unused patterns are tree-shaken, but `createKeystra` always includes every navigation mode, selection and typeahead.

| Import | Minified | Gzip |
| --- | --- | --- |
| `createKeyBinding` | 10.22 kB | 3.79 kB |
| `createKeystra` | 45.21 kB | 13.27 kB |
| `createRovingFocus` | 45.48 kB | 13.38 kB |
| Everything | 66.29 kB | 18.55 kB |

`npm run bench` compares roving focus and shortcuts in real Chrome. These are median milliseconds per key press, measured on one Windows machine:

| Items | Native baseline | roving-ux | Keystra | Keystra with `observe: true` |
| --- | --- | --- | --- | --- |
| 100 | 0.1 | 0.1 | 0.4 | 0.2 |
| 1,000 | 0.1 | 0.1 | 3.0 | 0.2 |
| 10,000 | 0.1 | 0.1 | 21.4 | 0.2 |

The comparison shows the cost of features, not a winner. The baseline and roving-ux (0.69 kB gzip) never re-read the DOM, so they miss added, disabled or hidden items, while Keystra checks them on every press. With `observe: true` a `MutationObserver` does that work instead, so use it for lists of about 1,000 items or more. Startup is also slower: 8.7 ms for 1,000 items against 0.8 ms for roving-ux, and a 10,000-item group retains about 420 kB.

For 20 shortcuts, a press took 68 µs with `createKeyBinding`, 34 µs with tinykeys (0.93 kB gzip) and 37 µs with hotkeys-js (3.6 kB gzip). If shortcuts are all you need, those libraries are smaller and faster. Keystra's case is one engine for navigation, focus and selection, not the smallest size for any single job.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
npm run test:browser
npm run size
npm run bench
npm run verify
```

`npm test` runs in happy-dom. `npm run test:browser` and `npm run bench` drive the Chrome installed on your machine, which covers native activation, Tab order and stylesheet visibility.

## License

MIT — see [LICENSE](LICENSE).

# API

## createKeystra(options)

```ts
import { createKeystra } from 'keystra';

const nav = createKeystra({
  container: '#list',
  items: 'button',
  mode: 'vertical',
  loop: true,
  onFocus: (element, index) => {},
  onSelect: (element, index) => {},
});
```

### Options

| Option | Default | Description |
| --- | --- | --- |
| `container` | | Element or selector that holds the items. |
| `items` | `[data-keystra-item]` | Selector, or a function returning elements. |
| `elements` | | A fixed list of elements, used instead of `items`. |
| `mode` | `vertical` | `vertical`, `horizontal`, `sequential`, `grid`, `directional` or `custom`. |
| `loop` | `false` | Wrap around at the ends. |
| `columns` | | Columns per row in `grid` mode. Measured from layout when omitted. |
| `pageSize` | `10` | Items moved by PageUp and PageDown. |
| `keys` | | Key map, merged over the defaults for the mode. |
| `useDefaultKeys` | `true` | `false` keeps only your `keys`. |
| `sequences` | | Multi-key sequences. |
| `typeahead` | `false` | Jump to an item by typing its first letters. |
| `selection` | | Turn on selection. See [Selection](#selection). |
| `roving` | `true` | Manage `tabindex` so the group is one Tab stop. |
| `activeDescendant` | | Move a cursor with `aria-activedescendant` and leave focus where it is. |
| `autoFocus` | `false` | Focus an item on creation. |
| `observe` | `false` | Watch the DOM with a `MutationObserver`. |
| `filter` | | Return `false` to exclude an item. |
| `when` | | Only handle keys while this returns `true`. |
| `strategy` | | Replace the built-in navigation. See [Custom navigation](#custom-navigation). |

Callbacks: `onFocus`, `onBlur`, `onSelect`, `onAction`, `onEscape` and `onRefresh`.

### Methods

| Method | Description |
| --- | --- |
| `next()`, `previous()` | Move one item. |
| `focusFirst()`, `focusLast()` | Jump to an end. |
| `focusIndex(index)`, `focusElement(element)` | Focus a specific item. |
| `move(direction)` | Move `up`, `down`, `left` or `right`. |
| `perform(action)` | Run any bound action by name. |
| `restoreFocus()` | Return focus to where it was before. |
| `refresh()` | Re-read the items now. |
| `add(element)`, `remove(element)`, `setItems(elements)` | Register items yourself. |
| `update(options)` | Change `keys`, `loop`, `mode`, `columns`, `pageSize`, `enabled` or `container`. |
| `enable()`, `disable()` | Resume or pause key handling. |
| `on(event, handler)`, `off(event, handler)` | Subscribe to events. |
| `destroy()` | Remove everything. See [Lifecycle](#lifecycle). |

Properties: `items`, `activeElement`, `activeIndex`, `currentIndex` and `selection`. `activeIndex` is the item with DOM focus, and `currentIndex` keeps the position after focus leaves.

Events: `focus`, `blur`, `select`, `action`, `keydown`, `selectionchange`, `refresh` and `destroy`.

## Keys

```ts
createKeystra({
  container: '#list',
  keys: {
    next: 'j',
    previous: 'k',
    first: 'Ctrl+Home',
    last: false,
    archive: 'Shift+A',
  },
  sequences: [{ binding: ['g', 'g'], action: 'first' }],
  onAction: (action, event, element, index) => {
    if (action === 'archive') archive(element);
  },
});
```

- A key you set replaces the default for that action, and `false` removes it.
- Any other name is a custom action, passed to `onAction`.
- Modifiers are `Ctrl`, `Alt`, `Shift` and `Meta`.
- Use `{ code: 'KeyK', ctrl: true }` to match a physical key on any layout.
- Sequences that start with the same key work together, such as `g g` and `g i`.

Tab is only handled if you bind it. Keys typed in a text field are left alone, unless you set `ignoreEditable: false`.

Keystra leaves a key to the browser when nothing handles it:

- **Enter and Space** still click a link or button, unless `onSelect`, `onAction`, selection or a pattern handles them.
- **Escape** still reaches a surrounding dialog, unless `onEscape`, `onAction` or a pattern handles it.
- `nav.on(...)` listeners don't count, so call `event.preventDefault()` in them if you need to.

### createKeyBinding(keys, handler, options)

A shortcut for the whole document, outside any group.

```ts
const binding = createKeyBinding(['Ctrl+S', 'Meta+S'], () => saveDocument());

binding.disable();
binding.enable();
binding.destroy();
```

A plain letter binding doesn't fire while the user is typing in a field, but a chord like `Ctrl+K` does. Set `allowInEditable: true` to allow both.

## Selection

```ts
const nav = createKeystra({
  container: '#files',
  selection: { mode: 'multiple', selectedClass: 'is-selected' },
});

nav.selection?.select(0);
nav.selection?.toggle(1);
nav.selection?.selectRange(2, 4);
nav.selection?.selectAll();
nav.selection?.clear();
nav.selection?.selected;
```

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `single` | `single`, `multiple`, `range` or `none`. |
| `initial` | | Items to select at the start. |
| `followFocus` | `false` | Select the focused item. |
| `selectOnActivate` | `true` | Select on Enter. |
| `aria` | `false` | Write `aria-selected`. |
| `attribute` | | Attribute to set on selected items, such as `data-selected`. |
| `selectedClass` | | Class to set on selected items. |
| `onChange` | | Called with the selected items. |

## Custom navigation

A strategy returns the next index, or `null` to stay put.

```ts
createKeystra({
  container: '#list',
  strategy: ({ index, action, items }) => {
    if (action === 'next') return Math.min(index + 2, items.length - 1);
    return null;
  },
});
```

`onBeforeNavigate` runs first and can override the result for a single move.

## Changing items

Keystra re-reads the items on each key press, so added, removed, reordered, disabled and hidden items just work. Call `refresh()` if you need the new list sooner, or use `observe: true` for long lists. See [Performance](performance.md).

## Nested groups

Items inside an inner group belong to that group, even if the outer selector matches them. Keys the inner group doesn't bind bubble up to the outer group.

## Lifecycle

`destroy()` removes all listeners and observers, and restores `tabindex` and `aria-activedescendant`. An instance can't be reused afterwards.

`useKeystra` helps when the element doesn't exist yet. It isn't a React hook and can be called anywhere.

```ts
const handle = useKeystra({ loop: true });

handle.attach(element);
handle.detach();
handle.destroy();
```

`attach` creates the instance the first time, `detach` stops listening and allows another `attach`, and `destroy` is permanent.

## TypeScript

```ts
import { createKeystra, type KeystraOptions } from 'keystra';

const options: KeystraOptions<HTMLButtonElement> = {
  container: '#actions',
  items: 'button',
};

const nav = createKeystra<HTMLButtonElement>(options);
```

## Imports

Everything is available from `keystra`, and also from `keystra/core`, `keystra/patterns`, `keystra/navigation`, `keystra/focus`, `keystra/selection` and `keystra/utils`.

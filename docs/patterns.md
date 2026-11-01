# Patterns

Each pattern returns the normal instance from [the API](api.md) plus the extras listed here. Pass `aria: false` to manage ARIA yourself.

## Tabs

```ts
const tabs = createTabs({
  container: '#tabs',
  items: '[role="tab"]',
  panels: '[role="tabpanel"]',
  activation: 'automatic',
  onActivate: (tab, index) => {},
});

tabs.activate(1);
```

- Arrow keys move between tabs, and Home and End jump to the ends.
- `activation: 'manual'` waits for Enter or Space.
- `orientation: 'vertical'` uses the up and down arrows.

## Menu

```ts
const menu = createMenu({
  container: '#menu',
  items: '[role="menuitem"]',
  returnFocusTo: '#menu-button',
  onSelect: (item) => run(item.dataset.command),
});

menu.open();
menu.close();
menu.toggle();
```

- Enter or Space activates the item and closes the menu. `closeOnSelect: false` keeps it open.
- Escape closes the menu and returns focus.
- Typing a letter jumps to a matching item.
- A `hidden` attribute is removed on open and restored on close. `toggleHidden: false` leaves it to you.

## Dropdown

A menu with a trigger button.

```ts
const dropdown = createDropdown({
  trigger: '#sort-button',
  container: '#sort-menu',
  items: '[role="menuitem"]',
  onSelect: (item) => sortBy(item.dataset.key),
});
```

- Enter, Space or ArrowDown opens on the first item, and ArrowUp opens on the last.
- Tab closes the menu and moves on from the trigger.
- Clicking outside closes it. `closeOnOutsidePointer: false` turns that off.
- `closeOnBlur: true` also closes it when focus leaves.

## List

```ts
const list = createList({
  container: '#files',
  items: '.row',
  selection: { mode: 'multiple' },
  onSelect: (row) => open(row.dataset.id),
});

list.selection?.selected;
```

- Typeahead is on, and selection defaults to `single`, following focus.
- Space toggles in `multiple` mode, and Shift+Arrow extends in `range` mode.

## Grid

```ts
const grid = createGrid({
  container: '#calendar',
  items: '[role="gridcell"]',
  columns: 7,
});

grid.position;
grid.focusCell(0, 3);
```

- Arrow keys move in both directions, and PageUp and PageDown skip `pageSize` cells.
- `rowHomeEnd: true` makes Home and End stay in the current row.
- `maintainColumn: false` moves to the row start when changing rows.
- Without `columns`, rows are measured from layout, so uneven rows work too.

## Tree

```html
<ul id="tree" role="tree">
  <li role="treeitem" aria-expanded="false">
    Documents
    <ul role="group" hidden>
      <li role="treeitem">Resume</li>
    </ul>
  </li>
</ul>
```

```ts
const tree = createTree({
  container: '#tree',
  toggleHidden: true,
  onExpand: (node) => load(node.dataset.id),
});

tree.expandAll();
tree.collapseAll();
```

- ArrowRight expands a node, then moves to its first child.
- ArrowLeft collapses a node, then moves to its parent.
- Keystra writes `aria-expanded`, but only hides groups with `toggleHidden` or `hiddenClass`.

## Command palette

Focus stays in the search field while the arrow keys move through the results.

```ts
const palette = createCommandPalette({
  container: '#palette',
  input: '#palette-input',
  list: '#palette-results',
  items: '[role="option"]',
  openKeys: ['Ctrl+K', 'Meta+K'],
  onQuery: (query) => {
    renderResults(search(query));
    palette.refresh();
  },
  onSubmit: (item, query) => run(item?.dataset.command),
});
```

- You own the data: render the results in `onQuery`, then call `refresh()`.
- Enter with no results still calls `onSubmit`, with `null` as the item.
- Escape closes the palette and returns focus.
- If the input sits inside `container`, set `list` to the element holding the results, because an input can't sit inside a listbox.

## Roving focus

The smallest pattern, for toolbars, radio groups and chip lists. All four arrow keys move one Tab stop through the group.

```ts
const toolbar = createRovingFocus({
  container: '#toolbar',
  items: 'button',
  mode: 'horizontal',
});
```

Setting `mode` limits it to one direction. `initialIndex` picks the first Tab stop.

# Performance

## Bundle size

Unused patterns are tree-shaken, but `createKeystra` always includes every navigation mode, selection and typeahead.

| Import | Minified | Gzip |
| --- | --- | --- |
| `createKeyBinding` | 10.22 kB | 3.79 kB |
| `createKeystra` | 45.21 kB | 13.27 kB |
| `createRovingFocus` | 45.48 kB | 13.38 kB |
| Everything | 66.29 kB | 18.55 kB |

## Long lists

By default Keystra checks the item list on every key press, so it doesn't miss DOM changes. For about 1,000 items or more, set `observe: true`, which lets a `MutationObserver` do that work instead.

```ts
createKeystra({ container: '#list', observe: true });
```

Median milliseconds per key press in Chrome, on one Windows machine:

| Items | Default | `observe: true` |
| --- | --- | --- |
| 100 | 0.4 | 0.2 |
| 1,000 | 3.0 | 0.2 |
| 10,000 | 21.4 | 0.2 |

A 10,000-item group holds about 420 kB of memory.

## Compared with smaller libraries

If you only need one thing, a smaller library may suit you better. Keystra's case is one engine for navigation, focus and selection.

| Job | Keystra | Alternative |
| --- | --- | --- |
| Roving focus size (gzip) | 13.38 kB | `roving-ux`: 0.69 kB |
| Shortcuts size (gzip) | 3.79 kB | `tinykeys`: 0.93 kB, `hotkeys-js`: 3.6 kB |
| Key press on 10,000 items | 0.2 ms with `observe: true` | `roving-ux`: 0.1 ms |
| One shortcut press, with 20 bound | 68 µs | `tinykeys`: 34 µs, `hotkeys-js`: 37 µs |

`roving-ux` doesn't re-read the DOM, so it misses added, disabled or hidden items. Keystra does that extra work.

The benchmark is in [`benchmarks/run.mjs`](../benchmarks/run.mjs).

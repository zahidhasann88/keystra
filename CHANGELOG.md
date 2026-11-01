# Changelog

This project follows [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-11-02

First release.

- `createKeystra()` engine: key normalization and matching, modifier chords,
  multi-key sequences, custom key maps and event delegation.
- Navigation modes: sequential, vertical, horizontal, grid, directional and
  custom strategies, with looping and disabled and hidden item skipping.
- Focus management: roving tabindex, `aria-activedescendant`, focus restoration
  and nested groups.
- Selection: single, multiple and range modes, independent of styling.
- Patterns: `createTabs`, `createMenu`, `createDropdown`, `createList`,
  `createGrid`, `createTree`, `createCommandPalette` and `createRovingFocus`.
- `createKeyBinding()` for document-level shortcuts, and `useKeystra()` for
  elements that do not exist yet.
- Dynamic DOM support through `refresh()`, explicit registration and optional
  mutation observation.
- ESM, CommonJS and script-tag builds, TypeScript declarations and deep imports
  such as `keystra/patterns`. No runtime dependencies.

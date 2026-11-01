# Accessibility

Keystra handles keyboard behavior, but it can't make any markup accessible by itself.

## What Keystra does

- Keeps each group to one Tab stop with roving tabindex.
- Skips disabled and hidden items.
- Follows the keyboard patterns in the [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/).
- Fills in missing roles, such as `listbox`, `option`, `menu` and `tablist`.
- Maintains state such as `aria-selected`, `aria-expanded` and `aria-activedescendant`.

It never replaces a role you wrote, and it leaves landmarks like `<nav>` alone. Pass `aria: false` on a pattern to manage ARIA yourself.

## What stays yours

- Valid markup, using native elements where you can.
- Accessible names and labels.
- A visible focus style.
- Row and cell structure in a grid.
- Testing with your users' browsers and screen readers.

## Browser support

Keystra targets modern browsers with ES2020 and standard DOM APIs.

Its focus and keyboard behavior is tested in Chrome. It hasn't been tested in Firefox or Safari yet, or with screen readers, so check those for your app.

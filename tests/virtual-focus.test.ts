import { afterEach, describe, expect, it } from 'vitest';
import { createKeystra } from '../src/index.js';
import { resetDom } from './helpers.js';
afterEach(resetDom);
describe('aria-activedescendant focus', () => {
  it('moves the virtual cursor without moving focus from its owner', () => {
    document.body.innerHTML = '<div id="widget"><input id="search"><div data-keystra-item>First</div><div data-keystra-item>Second</div></div>';
    const input = document.querySelector<HTMLInputElement>('#search')!;
    const items = [...document.querySelectorAll<HTMLElement>('[data-keystra-item]')];
    const nav = createKeystra({container:'#widget', target:input, activeDescendant:input});
    input.focus(); nav.focusIndex(0);
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-activedescendant')).toBe(items[0]!.id);
    nav.focusIndex(1);
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-activedescendant')).toBe(items[1]!.id);
    expect(nav.activeIndex).toBe(1);
    nav.destroy();
  });
});

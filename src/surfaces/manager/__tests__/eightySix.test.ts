import { describe, expect, it } from 'vitest';
import { markedIn, menuForToday, searchToday, specialsOf } from '../eightySix/menuToday';

describe('86 list: adding', () => {
  const cats = menuForToday('Dinner', '');

  it('pins today’s specials, each once', () => {
    const specials = specialsOf(cats);
    expect(specials.length).toBeGreaterThan(0);
    expect(specials.every((it) => it.special)).toBe(true);
    expect(specials.some((it) => it.name.startsWith('Peach Glazed Chicken'))).toBe(true);
  });

  it('counts what is marked in a category', () => {
    const [, items] = cats[0];
    const ids = new Set([items[0].id, 'not-on-the-menu']);
    expect(markedIn(items, (id) => ids.has(id))).toBe(1);
    expect(markedIn(items, () => false)).toBe(0);
  });

  it('finds items by any word of the full or short name, starts-with first', () => {
    expect(searchToday('Dinner', '  ')).toEqual([]);
    const short = (it: { name: string }) => (it.name.startsWith('Peach Glazed Chicken') ? 'Peach Chicken' : it.name);
    expect(searchToday('Dinner', 'peach chicken', short).map((it) => it.name)).toContain('Peach Glazed Chicken Breast');
    const hits = searchToday('Dinner', 'sal');
    expect(hits.length).toBeGreaterThan(1);
    expect(hits.every((it) => it.name.toLowerCase().includes('sal'))).toBe(true);
    const starts = hits.map((it) => it.name.toLowerCase().startsWith('sal'));
    expect(starts).toEqual([...starts].sort((a, b) => Number(b) - Number(a)));
  });
});

import { describe, expect, it } from 'vitest';
import { alcWarnings } from '../cycles/AlcCounter';

const count = (items: number, sides: number) => ({ items, sides, limitItems: 20, limitSides: 8 }) as Parameters<typeof alcWarnings>[0];

describe('à la carte menu standard', () => {
  it('says how much to cut when over, nothing at or under the limit', () => {
    expect(alcWarnings(count(20, 8))).toEqual([]);
    expect(alcWarnings(count(65, 12))).toEqual(['45 menu items', '4 sides']);
    expect(alcWarnings(count(21, 9))).toEqual(['1 menu item', '1 side']);
    expect(alcWarnings(count(12, 10))).toEqual(['2 sides']);
  });
});

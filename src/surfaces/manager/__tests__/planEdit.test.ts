import { describe, expect, it } from 'vitest';
import type { PlanItem } from '../../../store/floorLayout';
import { alignItems, copyItems, distributeItems, resizeItem, turnItem } from '../floor/planEdit';

const t = (id: string, x: number, y: number, w = 10, h = 10, label = id): PlanItem => ({ id, label, section: '', type: 'seat', x, y, w, h });

describe('reshaping on the plan', () => {
  it('moves only the dragged edges and keeps the opposite edge put', () => {
    expect(resizeItem(t('a', 10, 10), 'se', 5, 3)).toMatchObject({ x: 10, y: 10, w: 15, h: 13 });
    expect(resizeItem(t('a', 10, 10), 'nw', 4, -2)).toMatchObject({ x: 14, y: 8, w: 6, h: 12 });
    expect(resizeItem(t('a', 10, 10), 'e', 0, 50)).toMatchObject({ w: 10, h: 10 });
  });

  it('never goes below the smallest size or off the plan', () => {
    expect(resizeItem(t('a', 10, 10), 'w', 30, 0)).toMatchObject({ x: 18, w: 2 });
    expect(resizeItem(t('a', 90, 10), 'e', 50, 0)).toMatchObject({ x: 90, w: 10 });
    expect(resizeItem(t('a', 10, 10), 'n', 0, -40)).toMatchObject({ y: 0, h: 20 });
  });

  it('turns an item a quarter around its centre', () => {
    expect(turnItem(t('w', 40, 50, 20, 4))).toMatchObject({ w: 4, h: 20, x: 48, y: 42 });
  });
});

describe('copying', () => {
  it('places copies to the right of the originals with the next free table names', () => {
    const all = [t('a', 10, 10, 10, 10, 'SQ 1'), t('b', 30, 10, 10, 10, 'SQ 2')];
    let n = 0;
    const out = copyItems(all, all, () => `c${++n}`);
    expect(out.map((x) => [x.id, x.label, x.x, x.y])).toEqual([
      ['c1', 'SQ 3', 41, 10],
      ['c2', 'SQ 4', 61, 10],
    ]);
  });

  it('goes below when there is no room to the right', () => {
    const out = copyItems([], [t('a', 85, 10, 10, 10, 'SQ 1')], () => 'x');
    expect(out[0]).toMatchObject({ x: 85, y: 21 });
  });

  it('pastes a group with its top-left at a spot', () => {
    const all = [t('a', 10, 10, 10, 10, 'SQ 1'), t('b', 30, 20, 10, 10, 'SQ 2')];
    const out = copyItems(all, all, () => 'x', { x: 50, y: 50 });
    expect(out.map((x) => [x.x, x.y])).toEqual([
      [50, 50],
      [70, 60],
    ]);
  });
});

describe('lining up', () => {
  it('aligns to the group edges and centres', () => {
    const items = [t('a', 10, 10), t('b', 30, 20, 20, 10)];
    expect(alignItems(items, 'left').map((x) => x.x)).toEqual([10, 10]);
    expect(alignItems(items, 'right').map((x) => x.x)).toEqual([40, 30]);
    expect(alignItems(items, 'top').map((x) => x.y)).toEqual([10, 10]);
    expect(alignItems(items, 'middle').map((x) => x.y)).toEqual([15, 15]);
  });

  it('spaces three or more evenly, keeping the outer ones', () => {
    const items = [t('a', 0, 0), t('b', 12, 0), t('c', 60, 0)];
    expect(distributeItems(items, 'across').map((x) => x.x)).toEqual([0, 30, 60]);
    expect(distributeItems(items.slice(0, 2), 'across')).toEqual(items.slice(0, 2));
  });
});

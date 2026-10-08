import { describe, expect, it } from 'vitest';
import type { BoModGroup } from '../../../../store/menuEdits';
import { exportWeeks, weekLabel } from '../export/exportDays';
import { paperCss, paperOf, weekRowHeight } from '../model/menuPrint';
import { OTHER_COMMUNITY_MODS, planCopy } from '../modifiers/copyGroups';

describe('copy modifiers from another community', () => {
  const ours: BoModGroup[] = [
    { id: 'g_dress', name: 'Dressing', active: true, usage90: 10, pinned: ['r1'], mods: [{ n: 'Ranch', price: 0.5 }, { n: 'Italian' }] },
    { id: 'g_old', name: 'Toast', active: false, usage90: 0, pinned: [], mods: [] },
  ];
  let n = 0;
  const id = () => `new${++n}`;

  it('adds missing groups and only the choices an existing group lacks', () => {
    const plan = planCopy(ours, [
      { name: 'dressing', mods: [{ n: 'RANCH' }, { n: 'Greek' }] },
      { name: 'Toast', mods: [{ n: 'Rye' }] },
    ], id);
    expect(plan.added).toEqual(['Toast']);
    expect(plan.extended).toEqual([{ name: 'Dressing', choices: ['Greek'] }]);
    const dressing = plan.groups.find((g) => g.id === 'g_dress')!;
    // Existing choices keep their up-charge and the pins stay.
    expect(dressing.mods).toEqual([{ n: 'Ranch', price: 0.5 }, { n: 'Italian' }, { n: 'Greek' }]);
    expect(dressing.pinned).toEqual(['r1']);
    // A retired group of the same name is left alone; the copy comes in as a new active group.
    expect(plan.groups.filter((g) => g.name === 'Toast').map((g) => g.active)).toEqual([false, true]);
  });

  it('changes nothing when we already have it all', () => {
    const plan = planCopy(ours, [{ name: 'Dressing', mods: [{ n: 'Italian' }] }], id);
    expect(plan.added).toEqual([]);
    expect(plan.extended).toEqual([]);
    expect(plan.groups).toEqual(ours);
  });

  it('has something to copy from every community it lists', () => {
    for (const groups of Object.values(OTHER_COMMUNITY_MODS)) expect(groups.length).toBeGreaterThan(0);
  });
});

describe('menu export weeks and paper', () => {
  it('offers four weeks back and eight ahead, each from its Sunday', () => {
    const weeks = exportWeeks(new Date(2026, 9, 8, 12));
    expect(weeks).toHaveLength(13);
    expect(weeks.every((d) => d.getDay() === 0)).toBe(true);
    expect(weeks[4]).toEqual(new Date(2026, 9, 4));
    expect(weeks[0]).toEqual(new Date(2026, 8, 6));
    expect(weekLabel(weeks[4])).toBe('Sun 10/4 – Sat 10/10');
  });
  it('sizes the page for the paper and scales a half sheet down', () => {
    expect(paperCss(paperOf('half'))).toContain('@page{size:5.5in 8.5in;margin:0.35in}');
    expect(paperCss(paperOf('letter'), true)).toContain('@page{size:11in 8.5in;margin:0.5in}');
    expect(paperCss(paperOf('a4'))).toContain('size:8.27in 11.69in');
    expect(paperCss(paperOf('half'))).toContain('zoom:0.72');
    expect(paperOf('nope').id).toBe('letter');
  });
  it('fits the week at a glance rows to the page', () => {
    expect(weekRowHeight(paperOf('letter'), 3)).toBeCloseTo(1.57, 2);
    expect(weekRowHeight(paperOf('letter'), 2)).toBeCloseTo(2.35, 2);
    expect(weekRowHeight(paperOf('half'), 3)).toBeLessThan(weekRowHeight(paperOf('letter'), 3));
  });
});

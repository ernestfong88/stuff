import { describe, expect, it } from 'vitest';
import type { BoModGroup } from '../../../../store/menuEdits';
import { dayLabel, exportDays, exportWeeks } from '../export/exportDays';
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

describe('menu export days and weeks', () => {
  it('offers today and the next six days, stopping at the end of the cycle', () => {
    expect(exportDays(15, 35)).toEqual([15, 16, 17, 18, 19, 20, 21]);
    expect(exportDays(33, 35)).toEqual([33, 34, 35]);
    expect(exportDays(0, 35)).toEqual([]);
  });
  it('offers this week and next when the cycle has a next week', () => {
    expect(exportWeeks(2, 35)).toEqual([2, 3]);
    expect(exportWeeks(4, 35)).toEqual([4]);
    expect(exportWeeks(0, 0)).toEqual([]);
  });
  it('names the days', () => {
    const fri = new Date(2026, 9, 9, 12);
    expect(dayLabel(0, fri)).toBe('Today');
    expect(dayLabel(1, fri)).toBe('Tomorrow');
    expect(dayLabel(2, fri)).toBe('Fri 10/9');
  });
});

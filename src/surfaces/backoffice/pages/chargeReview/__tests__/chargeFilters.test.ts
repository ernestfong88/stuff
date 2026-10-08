import { describe, expect, it } from 'vitest';
import type { Charge } from '../../../seed/billing';
import { approveAll, chargeCategories, chargeCategory, chargeTotal, filterCharges, sendToBilling } from '../charges';

const at = new Date(2026, 9, 8, 15).getTime();
const day = (d: number) => new Date(2026, 9, d, 10).getTime();
const base: Charge = {
  id: 'a',
  residentId: 'r1',
  level: 'IL',
  date: day(8),
  item: 'MEAL',
  desc: '',
  amount: 12.5,
  active: true,
  approvedAt: null,
  approvedBy: null,
  importedAt: null,
  source: 'meal',
};
const list: Charge[] = [
  base,
  { ...base, id: 'b', item: 'GMEAL', amount: 20, date: day(7) },
  { ...base, id: 'c', item: 'TRAY', source: 'delivery', amount: 3, date: day(1) },
  { ...base, id: 'd', item: 'TRAY', source: 'delivery', amount: 3, active: false },
  { ...base, id: 'e', item: '', source: 'manual', amount: 7.25 },
  { ...base, id: 'f', item: 'WINE', amount: 9 },
];

describe('charge approval filters', () => {
  it('files each charge by its item code, else where it came from', () => {
    expect(list.map(chargeCategory)).toEqual(['MEAL', 'GMEAL', 'TRAY', 'TRAY', 'MANUAL', 'WINE']);
  });

  it('lists the categories present with counts, known ones first', () => {
    expect(chargeCategories(list)).toEqual([
      { id: 'MEAL', label: 'Meal', count: 1 },
      { id: 'GMEAL', label: 'Guest meal', count: 1 },
      { id: 'TRAY', label: 'Delivery', count: 2 },
      { id: 'MANUAL', label: 'Added by hand', count: 1 },
      { id: 'WINE', label: 'WINE', count: 1 },
    ]);
    expect(chargeCategories([])).toEqual([]);
  });

  it('combines categories with the date range', () => {
    const ids = (f: Parameters<typeof filterCharges>[1]) => filterCharges(list, f, at).map((c) => c.id);
    expect(ids({ categories: [], range: { preset: 'all' } })).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(ids({ categories: ['TRAY', 'GMEAL'], range: { preset: 'all' } })).toEqual(['b', 'c', 'd']);
    expect(ids({ categories: ['TRAY', 'GMEAL'], range: { preset: 'last7' } })).toEqual(['b', 'd']);
    expect(ids({ categories: [], range: { preset: 'yesterday' } })).toEqual(['b']);
  });

  it('totals only live charges', () => {
    expect(chargeTotal(list)).toBe(51.75);
    expect(chargeTotal(filterCharges(list, { categories: ['TRAY'], range: { preset: 'all' } }, at))).toBe(3);
  });

  it('approves and sends only the charges shown', () => {
    const shown = new Set(['a', 'c']);
    const approved = approveAll(list, 'EF', 5, shown);
    expect(approved.filter((c) => c.approvedAt).map((c) => c.id)).toEqual(['a', 'c']);
    expect(
      approveAll(list, 'EF', 5)
        .filter((c) => c.approvedAt)
        .map((c) => c.id),
    ).toEqual(['a', 'b', 'c', 'e', 'f']);
    const sent = sendToBilling(approveAll(list, 'EF', 5), 6, new Set(['b']));
    expect(sent.filter((c) => c.importedAt).map((c) => c.id)).toEqual(['b']);
  });
});

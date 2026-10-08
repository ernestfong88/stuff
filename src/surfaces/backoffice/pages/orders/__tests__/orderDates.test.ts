import { describe, expect, it } from 'vitest';
import type { Order } from '../../../../../domain/types';
import { filterRows, rowTime, type OrderRow } from '../orderRows';

const at = new Date(2026, 9, 8, 18).getTime();
const day = (d: number, h = 12) => new Date(2026, 9, d, h).getTime();
const row = (id: string, openedAt: number, closedAt: number | null, extra: Partial<OrderRow> = {}): OrderRow => ({
  order: { id, openedAt, closedAt, server: 's1', diners: [] } as unknown as Order,
  open: closedAt == null,
  lead: undefined,
  leadName: id,
  names: id,
  charged: 0,
  apartment: false,
  feedback: null,
  ...extra,
});
const rows = [
  row('today', day(8, 11), day(8, 12)),
  row('late', day(7, 23), day(8, 0)),
  row('open', day(8, 17), null),
  row('old', day(1), day(1), { charged: 5 }),
];
const base = { query: '', server: 'All', charge: 'All' as const };

describe('order history date range', () => {
  it('dates a check by when it closed, else when it opened', () => {
    expect(rows.map(rowTime)).toEqual([day(8, 12), day(8, 0), day(8, 17), day(1)]);
  });

  it('combines the range with the other filters', () => {
    const ids = (f: Partial<Parameters<typeof filterRows>[1]>) => filterRows(rows, { ...base, at, ...f }).map((r) => r.order.id);
    expect(ids({})).toEqual(['today', 'late', 'open', 'old']);
    expect(ids({ range: { preset: 'today' } })).toEqual(['today', 'late', 'open']);
    expect(ids({ range: { preset: 'today' }, status: 'closed' })).toEqual(['today', 'late']);
    expect(ids({ range: { preset: 'yesterday' } })).toEqual([]);
    expect(ids({ range: { preset: 'custom', from: '2026-10-01', to: '2026-10-01' } })).toEqual(['old']);
    expect(ids({ range: { preset: 'month' }, charge: 'other' })).toEqual(['old']);
  });
});

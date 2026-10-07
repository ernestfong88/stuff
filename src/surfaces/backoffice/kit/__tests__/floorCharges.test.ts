import { describe, expect, it } from 'vitest';
import type { Order } from '../../../../domain/types';
import { floorCharges } from '../billing';

const closed = (drops: Array<string | null>, extra: Partial<Order> = {}): Order => ({
  id: 'o1',
  tableId: 't_eg6',
  room: 'sequoia',
  server: 'AA',
  meal: 'Dinner',
  openedAt: 1,
  closedAt: 1000,
  diners: drops.map((chargeDrop, i) => ({ id: `d${i}`, kind: 'resident', refId: 'r5', isGuest: i > 0, guestName: i > 0 ? 'Amy' : undefined, seat: i + 1, items: [], chargeDrop })),
  ...extra,
});

describe('floorCharges', () => {
  it('turns each apartment payment into a charge awaiting approval', () => {
    const [c] = floorCharges([closed(['apt:28'])]);
    expect(c).toMatchObject({ id: 'floor:o1:d0', residentId: 'r5', amount: 28, item: 'MEAL', desc: 'Dinner · EG 6', approvedAt: null, active: true });
  });

  it('marks a guest meal and keeps one charge per diner', () => {
    const list = floorCharges([closed(['apt:28', 'apt:16'])]);
    expect(list.map((c) => [c.item, c.amount])).toEqual([
      ['MEAL', 28],
      ['GMEAL', 16],
    ]);
  });

  it('skips plan, card, comp, amount-less drops and open checks', () => {
    expect(floorCharges([closed(['plan', 'card:12:x', 'comp:Sick:9', 'apt', null])])).toEqual([]);
    expect(floorCharges([closed(['apt:28'], { closedAt: undefined })])).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import type { Order } from '../../../../domain/types';
import type { Charge } from '../../seed/billing';
import { floorCharges, reconcileFloorCharges } from '../billing';

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

describe('reconcileFloorCharges', () => {
  const start = (o: Order) => reconcileFloorCharges([], [o]);

  it('adds a new floor charge once and leaves it alone when nothing changed', () => {
    const o = closed(['apt:20']);
    const list = start(o);
    expect(list).toHaveLength(1);
    expect(reconcileFloorCharges(list, [o])).toBe(list);
  });

  it('voids the waiting charge when the check is comped in Order History, and brings it back when the comp is removed', () => {
    const o = closed(['apt:20']);
    const list = start(o);
    const comped = reconcileFloorCharges(list, [{ ...o, comp: { reason: 'Back office correction', at: 2000 } }]);
    expect(comped[0]).toMatchObject({ active: false, approvedAt: null });
    expect(comped[0].desc).toContain('voided: check comped');
    const back = reconcileFloorCharges(comped, [o]);
    expect(back[0]).toMatchObject({ active: true, amount: 20 });
  });

  it('voids when paid another way, and follows a new amount on re-close back to review', () => {
    const o = closed(['apt:20']);
    const approved: Charge[] = start(o).map((c) => ({ ...c, approvedAt: 5, approvedBy: 'EF' }));
    expect(reconcileFloorCharges(approved, [closed(['card:20:x'])])[0]).toMatchObject({ active: false, approvedAt: null });
    expect(reconcileFloorCharges(approved, [closed(['apt:24'])])[0]).toMatchObject({ active: true, amount: 24, approvedAt: null });
  });

  it('voids while the check is reopened on the floor', () => {
    const o = closed(['apt:20']);
    const list = reconcileFloorCharges(start(o), [], [{ id: 'o1' }]);
    expect(list[0]).toMatchObject({ active: false });
    expect(list[0].desc).toContain('reopened');
  });

  it('keeps an edit or void made in Charge Approval, and never touches a charge sent to billing', () => {
    const o = closed(['apt:20']);
    const edited = start(o).map((c) => ({ ...c, amount: 15 }));
    expect(reconcileFloorCharges(edited, [o])).toBe(edited);
    const sent = start(o).map((c) => ({ ...c, importedAt: 9 }));
    expect(reconcileFloorCharges(sent, [{ ...o, comp: { reason: 'x', at: 1 } }])[0]).toMatchObject({ active: true, importedAt: 9 });
  });

  it('bills a bare apartment drop (delivery hand-off) at what is out of plan', () => {
    const o = closed(['apt'], { queueType: 'delivery', tableId: undefined });
    const [c] = floorCharges([o]);
    expect(c.amount).toBe(3);
    expect(c.desc).toBe('Dinner · Delivery');
  });
});

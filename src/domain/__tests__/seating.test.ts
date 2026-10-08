import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTable } from '../../data';
import { closeOrder } from '../diningActions';
import { tableName } from '../orders';
import { isEmptyCheck, moveNote, seatedAt, seatedAtText } from '../seating';
import { inVenue, tableRoom } from '../venue';
import { layoutStore, type PlanItem } from '../../store/layoutStore';
import { roomPlan, seedItems } from '../../store/floorLayout';
import { seatsText } from '../../surfaces/server/newcheck/floorTables';
import { T0, diner, freezeClock, line, order, stateOf } from './helpers';

beforeEach(() => freezeClock());
afterEach(() => {
  vi.useRealTimers();
  layoutStore.set({});
});

describe('tables from the saved floor plan', () => {
  const edited = (): PlanItem[] => [
    ...seedItems('sequoia').map((t) => (t.id === 't_eg7' ? { ...t, label: 'EG 7X' } : t)),
    { id: 't_new', label: 'SQ 17', section: 'Sequoia', type: 'seat', x: 80, y: 80, w: 10, h: 10 },
  ];

  it('names a renamed or added table everywhere getTable and tableName are read', () => {
    layoutStore.set({ sequoia: edited() });
    expect(getTable('t_eg7')?.label).toBe('EG 7X');
    expect(tableName(order([], { tableId: 't_new' }))).toBe('SQ 17');
    expect(tableName(order([], { tableId: 't_new', checkTag: 'B' }))).toBe('SQ 17B');
    expect(getTable('t_new')).toMatchObject({ room: 'sequoia' });
    // Pick up stations are not on the plan and still come from the seed.
    expect(getTable('t_pu1')?.label).toBe('P/U');
  });

  it('puts a check at a new table in its venue, so its server sees it on My tables', () => {
    const o = order([], { tableId: 't_new', room: 'sequoia' });
    expect(inVenue(o, 'sequoia')).toBe(false);
    layoutStore.set({ sequoia: edited() });
    expect(inVenue(o, 'sequoia')).toBe(true);
    expect(inVenue(o, 'bistro')).toBe(false);
    expect(tableRoom({ ...o, room: 'bistro' })).toBe('sequoia');
    expect(roomPlan('sequoia', layoutStore.get()).tables.some((t) => t.id === 't_new')).toBe(true);
  });

  it('keeps a removed table in its venue while a check is still open on it', () => {
    layoutStore.set({ sequoia: seedItems('sequoia').filter((t) => t.id !== 't_eg5') });
    expect(inVenue(order([], { tableId: 't_eg5' }), 'sequoia')).toBe(true);
    expect(tableName(order([], { tableId: 't_eg5' }))).toBe('EG 5');
  });
});

describe('a resident seated twice', () => {
  it('finds the open dine-in check they are already on, and says where', () => {
    const at = order([diner([line('d_peach'), line('d_coffee', { cancelled: true })], { refId: 'r1' })], { id: 'sq1', tableId: 't_sq1', server: 'AA' });
    const here = order([], { id: 'eg12', tableId: 't_eg12' });
    const found = seatedAt([at, here], 'r1', here.id);
    expect(found).toMatchObject({ dinerId: at.diners[0].id, table: getTable('t_sq1')?.label, server: 'Adriana', items: 1 });
    expect(seatedAtText('Marty Martin', found!)).toBe(`Marty is already at ${getTable('t_sq1')?.label} with Adriana`);
    expect(moveNote('Marty Martin', found!)).toContain('the 1 item');
  });

  it('ignores the check being added to, guests of theirs, and pick up orders', () => {
    const own = order([diner([], { refId: 'r1' })], { id: 'own' });
    const guest = order([diner([], { refId: 'r1', isGuest: true })], { id: 'guest' });
    const pickup = order([diner([], { refId: 'r1' })], { id: 'pu', queueType: 'pickup' });
    expect(seatedAt([own, guest, pickup], 'r1', own.id)).toBeNull();
  });
});

describe('an empty check', () => {
  it('is a dine-in check with nobody on it', () => {
    expect(isEmptyCheck(order([]))).toBe(true);
    expect(isEmptyCheck(order([diner([])]))).toBe(false);
    expect(isEmptyCheck(order([], { queueType: 'pickup' }))).toBe(false);
  });

  it('is dropped without a trace in history when voided', () => {
    const o = order([], { openedAt: T0 });
    const s = closeOrder(stateOf(o), o.id);
    expect(s.orders).toHaveLength(0);
    expect(s.history).toHaveLength(0);
  });
});

describe('seat wording on New check', () => {
  it('never says more seats are taken than the table has', () => {
    expect(seatsText({ covers: 3, seats: 4 })).toBe('3 of 4 seats taken');
    expect(seatsText({ covers: 5, seats: 4 })).toBe('5 seated at a table for 4');
  });
});

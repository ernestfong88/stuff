import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedOrders } from '../../../data';
import type { Diner, Order, OrderLine } from '../../../domain/types';
import { floorState, isLate } from '../floor/floorState';
import { greetConfig, greetInfo } from '../floor/greet';
import { courseWord, tableStage } from '../floor/stage';
import { needingHelp, triageByServer, triageReasons, triageRows } from '../floor/triage';
import prototype from './fixtures/prototypeFloor.json';

/** 6:00 PM on a fixed day. */
const T0 = new Date(2026, 9, 7, 18, 0, 0, 0).getTime();
const MIN = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

let n = 0;
const line = (itemId: string, extra: Partial<OrderLine> = {}): OrderLine => ({ id: 'l' + ++n, itemId, mods: {}, note: '', sent: false, kitchenState: null, ...extra });
const diner = (items: OrderLine[], extra: Partial<Diner> = {}): Diner => ({ id: 'd' + ++n, kind: 'resident', refId: 'r1', isGuest: false, seat: 1, items, ...extra });
const order = (diners: Diner[], extra: Partial<Order> = {}): Order => ({ id: 'o' + ++n, tableId: 't_sq3', room: 'sequoia', server: 'AA', meal: 'Dinner', openedAt: T0 - 20 * MIN, diners, ...extra });
/** Thresholds as Back Office ships them. */
const t = (k: string) => ({ passLate: 5, floorCook: 20, closeLate: 30, seatLate: 0, eatLate: 0 })[k] || Infinity;

describe('tableStage', () => {
  it('matches the prototype for every seeded check', () => {
    const got = Object.fromEntries(
      seedOrders()
        .filter((o) => o.id in prototype.stage)
        .map((o) => [o.id, [tableStage(o).key, tableStage(o).label]]),
    );
    expect(got).toEqual(prototype.stage);
  });

  it('walks a table from seating to ready to close', () => {
    expect(tableStage(order([diner([])])).key).toBe('seat');
    expect(tableStage(order([diner([line('d_peach')])])).label).toBe('Ordering');
    expect(tableStage(order([diner([line('d_peach', { sent: true, kitchenState: 'cooking', firedAt: T0 - 3 * MIN })])])).label).toBe('Cooking · C2');
    const ready = order([diner([line('d_peach', { sent: true, kitchenState: 'ready', firedAt: T0 - 9 * MIN, readyAtMs: T0 - 4 * MIN })])]);
    expect(tableStage(ready)).toMatchObject({ key: 'run', label: 'Ready at Expo · C2', since: T0 - 4 * MIN });
  });

  it('asks for a check-in after the entree, then dessert, then closes', () => {
    const served = line('d_peach', { sent: true, kitchenState: 'cleared', firedAt: T0 - 20 * MIN, clearedAt: T0 - 10 * MIN, course: 2 });
    const o = order([diner([served])]);
    expect(tableStage(o).label).toBe('Eating · C2');
    const checked = { ...o, checkIns: [{ course: 2, at: T0 - 5 * MIN, by: 'AA' }] };
    expect(tableStage(checked).label).toBe('Dessert?');
    expect(tableStage({ ...checked, noDessert: true }).key).toBe('check');
  });

  it('names courses the way the floor says them', () => {
    expect([1, 2, 3, 4].map(courseWord)).toEqual(['Starters', 'Entrees', 'Desserts', 'Course 4']);
  });
});

describe('floorState', () => {
  it('turns a ready table late past the pass threshold, matching Triage', () => {
    const states = Object.fromEntries(
      seedOrders()
        .filter((o) => !o.queueType)
        .map((o) => [o.id, floorState(o, undefined, t).key]),
    );
    const late = Object.entries(prototype.triage)
      .filter(([, why]) => why.length && why[0][0] === true && String(why[0][2]).includes('up'))
      .map(([id]) => id);
    for (const id of late) expect(states[id]).toBe('late');
    expect(states.o4).toBe('check');
    expect(states.o11).toBe('idle');
  });

  it('only flags seated tables when Back Office sets a threshold', () => {
    const o = order([diner([])]);
    expect(isLate('seat', 30, o, t)).toBe(false);
    expect(isLate('seat', 30, o, (k) => (k === 'seatLate' ? 10 : Infinity))).toBe(true);
  });

  it('says Time to close once a served table passes the close threshold', () => {
    const served = line('d_trifle', { sent: true, kitchenState: 'cleared', firedAt: T0 - 50 * MIN, clearedAt: T0 - 40 * MIN, course: 3 });
    expect(floorState(order([diner([served])]), undefined, t).word).toBe('Time to close');
  });
});

describe('triage', () => {
  it('gives the prototype reasons for every seeded table', () => {
    const live = seedOrders().filter((o) => !o.queueType);
    for (const o of live) {
      const raw: Array<Array<string | number | boolean>> | undefined = (prototype.triage as Record<string, Array<Array<string | number | boolean>>>)[o.id];
      if (!raw) continue;
      const want = raw.map((w) => [Boolean(w[0]), Number(w[1]), String(w[2]), String(w[3])] as const);
      const got = triageReasons(o, { t, checkInAfter: 2 });
      expect(got.map((w) => [w.late, w.act])).toEqual(want.map((w) => [w[0], w[3]]));
      got.forEach((w, i) => expect(Math.abs(w.mins - want[i][1])).toBeLessThanOrEqual(2));
    }
  });

  it('flags a table nobody has greeted after the host seated it', () => {
    const o = order([diner([])], { hostSeated: true, openedAt: T0 - 4 * MIN });
    expect(triageReasons(o, { t, checkInAfter: 2 })[0]).toMatchObject({ text: 'Seated 4 min, no server yet', act: 'Greet the table' });
  });

  it('puts the server with the most late tables first', () => {
    const rows = triageRows(seedOrders(), { t, checkInAfter: 2 });
    const by = triageByServer(rows);
    expect(by[0].server).toBe('AA');
    expect(by.every((x, i) => i === 0 || by[i - 1].late >= x.late)).toBe(true);
    expect(needingHelp(rows)[0].why[0].late).toBe(true);
  });
});

describe('greet', () => {
  it('uses the venue settings with defaults', () => {
    expect(greetConfig('sequoia', {})).toEqual({ over: 5, under: 2, meals: ['Dinner'] });
    expect(greetConfig('sequoia', { sequoia: { over: 7, under: '', meals: ['Lunch'] } })).toEqual({ over: 7, under: 2, meals: ['Lunch'] });
  });

  it('times greet to drinks and ignores meals the venue does not time', () => {
    const drinks = line('d_icedtea', { sent: true, drink: true, kitchenState: 'cleared', clearedAt: T0 - 14 * MIN });
    const o = order([diner([drinks])], { openedAt: T0 - 20 * MIN });
    expect(greetInfo(o, greetConfig('sequoia', {}))).toMatchObject({ mins: 6, slow: true });
    expect(greetInfo({ ...o, meal: 'Lunch' }, greetConfig('sequoia', {}))).toBeNull();
  });
});

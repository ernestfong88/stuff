/**
 * Order flow fixes: the bar switched off, held plates and their sides, sides
 * following their plate's route, pick up readiness and lateness, what a change
 * prints, and associate specials rung in on a tablet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalog } from '../../data';
import { serverRungCount } from '../assocMeals/serverRung';
import { DEFAULT_CONFIG, type DiningConfig } from '../config';
import { addItem, DEFAULT_CONTEXT, sendOrder, toggleHold } from '../diningActions';
import { isAlcohol } from '../menu';
import { heldCount } from '../orders';
import { pickupLateMinutes, pickupStage } from '../pickup';
import { newlyFired, printSummary, type PrintJob } from '../printing';
import { drinkRoute, drinkStartState, lineFoodRoute } from '../routing';
import { T0, diner, freezeClock, line, lines, order, stateOf } from './helpers';

const MIN = 60_000;

beforeEach(() => freezeClock());
afterEach(() => vi.useRealTimers());

describe('the Bar screen switched off', () => {
  const wine = catalog.find((i) => isAlcohol(i.id))!.id;

  it('sends bistro alcohol to the server to pour', () => {
    expect(drinkRoute(wine, 'bistro')).toBe('bar');
    const off: DiningConfig = { ...DEFAULT_CONFIG, barScreen: false };
    expect(drinkRoute(wine, 'bistro', off)).toBe('server');
    expect(drinkStartState(wine, 'bistro', off)).toBe('pour');
    // A venue override to the bar can't send it to a bar nobody works.
    expect(drinkRoute(wine, 'bistro', { ...off, route: { ['bistro|' + wine]: 'bar' } })).toBe('server');
  });

  it('a sent bistro drink is the server’s', () => {
    const o = order([diner([line(wine)])], { room: 'bistro', tableId: 't_b6' });
    const sent = sendOrder(stateOf(o), o.id, { ...DEFAULT_CONTEXT, cfg: { ...DEFAULT_CONFIG, barScreen: false } }).orders[0];
    expect(lines(sent)[0]).toMatchObject({ sent: true, drink: true, kitchenState: 'pour' });
  });
});

describe('holding a plate holds its sides', () => {
  const withEntree = () => {
    const d = diner([]);
    const o = order([d]);
    const s = addItem(stateOf(o), o.id, d.id, { id: 'e1', itemId: 'd_peach', mods: {}, sideIds: ['s1', 's2', 's3'] });
    return { s, o, d };
  };

  it('hold and release take the unsent sides along, and they never fire alone', () => {
    const { s, o, d } = withEntree();
    const sides = lines(s.orders[0]).filter((l) => l.parentId === 'e1');
    expect(sides.length).toBeGreaterThan(0);
    const held = toggleHold(s, o.id, d.id, 'e1');
    expect(lines(held.orders[0]).every((l) => l.hold)).toBe(true);
    // One held plate, not one per side.
    expect(heldCount(held.orders[0])).toBe(1);
    const sent = sendOrder(held, o.id).orders[0];
    expect(lines(sent).some((l) => l.sent)).toBe(false);
    const released = toggleHold(held, o.id, d.id, 'e1');
    expect(lines(released.orders[0]).some((l) => l.hold)).toBe(false);
  });

  it('a side rung in under a held plate waits with it', () => {
    const { s, o, d } = withEntree();
    const held = toggleHold(s, o.id, d.id, 'e1');
    const more = addItem(held, o.id, d.id, { id: 'x', itemId: 'd_fries', mods: {}, parentId: 'e1', sideIds: [] });
    expect(lines(more.orders[0]).find((l) => l.id === 'x')?.hold).toBe(true);
  });
});

describe('sides follow their plate', () => {
  it('the sides of an entrée the server makes skip the cook line', () => {
    const entree = line('d_peach');
    const side = line('d_mashed', { autoSide: true, parentId: entree.id });
    const cfg: DiningConfig = { ...DEFAULT_CONFIG, route: { 'sequoia|d_peach': 'expo' } };
    expect(lineFoodRoute(side, [entree, side], 'sequoia')).toBe('kds');
    expect(lineFoodRoute(side, [entree, side], 'sequoia', cfg)).toBe('expo');
    const o = order([diner([entree, side])]);
    const sent = sendOrder(stateOf(o), o.id, { ...DEFAULT_CONTEXT, cfg }).orders[0];
    expect(lines(sent).map((l) => l.kitchenState)).toEqual(['ready', 'ready']);
  });
});

describe('pick up readiness and lateness', () => {
  it('is ready once every plate is up, the way Expo judges it (sides go with them)', () => {
    const entree = line('d_peach', { sent: true, kitchenState: 'ready', course: 1 });
    const side = line('d_mashed', { sent: true, kitchenState: 'cooking', parentId: entree.id, course: 1 });
    const o = order([diner([entree, side])], { queueType: 'pickup', tableId: undefined });
    expect(pickupStage(o)).toBe('ready');
    expect(pickupStage({ ...o, diners: [diner([{ ...entree, kitchenState: 'cooking' }, side])] })).toBe('cooking');
  });

  it('counts lateness from the end of the booked range, in clock minutes', () => {
    const at = (h: number, m: number, s = 0) => new Date(2026, 9, 7, h, m, s).getTime();
    const delivery = (deliveredAt: number) =>
      order([], { queueType: 'delivery', tableId: undefined, readyAt: '4:30 PM', deliveredAt, closedAt: deliveredAt });
    // Inside the 4:30 to 4:45 range: on time.
    expect(pickupLateMinutes(delivery(at(16, 36)))).toBeLessThanOrEqual(0);
    expect(pickupLateMinutes(delivery(at(16, 45, 50)))).toBe(0);
    // Booked 1:15 to 1:30, delivered 1:40:40: 10 minutes late, as the screen's times read.
    const walter = order([], { queueType: 'delivery', tableId: undefined, readyAt: '1:15 PM', deliveredAt: at(13, 40, 40) });
    expect(pickupLateMinutes(walter)).toBe(10);
  });
});

describe('what a change prints', () => {
  it('lists the lines that reached the kitchen: new sends, fired holds and remakes', () => {
    const a = line('d_peach');
    const b = line('d_cbsoup', { sent: true, kitchenState: 'scheduled' });
    const c = line('d_trifle', { sent: true, kitchenState: 'scheduled' });
    const before = order([diner([a, b, c])]);
    const after = {
      ...before,
      diners: [diner([{ ...a, sent: true, kitchenState: 'cooking' }, { ...b, kitchenState: 'cooking' }, c, line('d_fee', { sent: true, kitchenState: 'cleared' })])],
    };
    expect(newlyFired(before, after).map((l) => l.itemId)).toEqual(['d_peach', 'd_cbsoup']);
    expect(newlyFired(undefined, after).map((l) => l.itemId)).toEqual(['d_peach', 'd_cbsoup']);
  });

  it('never claims a print at a printer that cannot be reached', () => {
    const job = (name: string, reachable: boolean, whole = false): PrintJob => ({
      printer: { id: name, name, type: 'Kitchen', reachable },
      items: ['Peach Chicken'],
      whole,
    });
    expect(printSummary([job('Hot Line', true), job('Expo Receipt', false, true)])).toBe(
      "Printed at Hot Line (1 item) · Not printed: Expo Receipt can't be reached",
    );
    expect(printSummary([job('Expo Receipt', false, true)])).toBe("Nothing printed · Not printed: Expo Receipt can't be reached");
  });
});

describe('associate specials rung in on a tablet', () => {
  it('count one per associate, today, at the meals that share the limit', () => {
    const today = '2026-10-07';
    const assoc = (meal: 'Lunch' | 'Dinner', openedAt = T0) =>
      order([diner([line('d_shells'), line('d_shells')], { kind: 'associate', refId: 'a1' })], { meal, openedAt });
    const checks = [assoc('Dinner'), assoc('Dinner'), assoc('Lunch'), assoc('Dinner', T0 - 24 * 60 * MIN), order([diner([line('d_shells')])])];
    expect(serverRungCount(checks, today, ['d_shells'], ['Dinner', 'NOC'])).toBe(2);
    expect(serverRungCount(checks, today, ['d_shells'], ['Lunch'])).toBe(1);
    expect(serverRungCount(checks, today, [], ['Dinner'])).toBe(0);
  });
});

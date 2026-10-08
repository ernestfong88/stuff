import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedOrders } from '../../data';
import { DEFAULT_CONFIG, type DiningConfig } from '../config';
import { COURSE_BACKUP_MIN, courseDue, courseWork, lastRun, checkedIn, runsLine } from '../courses';
import { DEFAULT_CONTEXT, pacingTick, runCourse, sendOrder, undoRunCourse } from '../diningActions';
import { clockLabel, pickupFireAt, pickupLeadMinutes } from '../pickup';
import { runUndoSnapshot } from '../courses';
import { tableStage } from '../tableStage';
import { T0, advance, diner, freezeClock, line, lines, order, prototype, stateOf } from './helpers';

const MIN = 60_000;

beforeEach(() => freezeClock());
afterEach(() => vi.useRealTimers());

const withMode = (mode: 'off' | 'expo' | 'timer5' | 'timer8' | 'manual'): DiningConfig => ({
  ...DEFAULT_CONFIG,
  course: { sequoia: { Dinner: mode } },
});

/** A dine-in check with soup (C1), an entrée with its side (C2), dessert (C3) and a coffee. */
function dinnerCheck() {
  const soup = line('d_cbsoup');
  const entree = line('d_peach');
  const side = line('d_mashed', { autoSide: true, parentId: entree.id });
  const dessert = line('d_trifle');
  const coffee = line('d_coffee');
  const o = order([diner([soup, entree, side, dessert, coffee])]);
  return { o, soup, entree, side, dessert, coffee };
}

describe('sendOrder (dine-in)', () => {
  it('fires the first course, holds later ones and sends drinks to the server', () => {
    const { o, soup, entree, side, dessert, coffee } = dinnerCheck();
    const sent = sendOrder(stateOf(o), o.id).orders[0];
    const byId = Object.fromEntries(lines(sent).map((i) => [i.id, i]));
    // Soup is made by the server (expo route), so it is ready at once.
    expect(byId[soup.id]).toMatchObject({ sent: true, course: 1, kitchenState: 'ready', firedAt: T0 });
    expect(byId[entree.id]).toMatchObject({ course: 2, kitchenState: 'scheduled' });
    expect(byId[side.id]).toMatchObject({ course: 2, kitchenState: 'scheduled' });
    expect(byId[dessert.id]).toMatchObject({ course: 3, kitchenState: 'scheduled' });
    expect(byId[coffee.id]).toMatchObject({ drink: true, course: undefined, kitchenState: 'pour' });
    expect(sent.sentAt).toBe(T0);
    expect(sent.fireAtTs).toBeUndefined();
  });

  it('fires the entrée at once when there is no earlier course', () => {
    const entree = line('d_peach');
    const o = order([diner([entree])]);
    expect(lines(sendOrder(stateOf(o), o.id).orders[0])[0].kitchenState).toBe('cooking');
  });

  it('with printers, fires every course at once and the table just waits to be closed', () => {
    const { o, entree, dessert } = dinnerCheck();
    const cfg = { ...DEFAULT_CONFIG, kitchenMode: 'printers' as const };
    const sent = sendOrder(stateOf(o), o.id, { ...DEFAULT_CONTEXT, cfg }).orders[0];
    const byId = Object.fromEntries(lines(sent).map((i) => [i.id, i]));
    // Nothing is held back for a later course.
    expect(byId[entree.id].kitchenState).not.toBe('scheduled');
    expect(byId[dessert.id].kitchenState).not.toBe('scheduled');
    expect(tableStage(sent, cfg)).toMatchObject({ key: 'check', label: 'Sent' });
  });

  it('leaves held lines unsent and sends alcohol to the bar where there is one', () => {
    const held = line('d_peach', { hold: true });
    const beer = line('d_beer805');
    const o = order([diner([held, beer])], { room: 'bistro' });
    const [h, b] = lines(sendOrder(stateOf(o), o.id).orders[0]);
    expect(h.sent).toBe(false);
    expect(b.kitchenState).toBe('bar');
  });
});

describe('sendOrder (pick up / delivery)', () => {
  it('schedules a future order for promised time minus the lead, then the timer fires it', () => {
    const promise = T0 + 60 * MIN;
    const o = order([diner([line('d_peach'), line('d_coffee')])], {
      tableId: undefined,
      queueType: 'pickup',
      readyAt: clockLabel(promise),
    });
    const ctx = { ...DEFAULT_CONTEXT, pickupLead: 20 };
    const s = sendOrder(stateOf(o), o.id, ctx);
    const sent = s.orders[0];
    expect(sent.fireAtTs).toBe(promise - 20 * MIN);
    expect(lines(sent).every((i) => i.course === 1 && i.kitchenState === 'scheduled')).toBe(true);

    advance(39 * MIN);
    expect(pacingTick(s.orders)).toBe(s.orders);
    advance(MIN);
    const fired = pacingTick(s.orders)[0];
    expect(fired.fireAtTs).toBeUndefined();
    // Even drinks go through the pass on a takeout order.
    expect(lines(fired).map((i) => i.kitchenState)).toEqual(['cooking', 'ready']);
  });

  it('fires at once when the fire time has passed', () => {
    const o = order([diner([line('d_peach')])], { tableId: undefined, queueType: 'delivery', readyAt: clockLabel(T0 + 10 * MIN) });
    const sent = sendOrder(stateOf(o), o.id, { ...DEFAULT_CONTEXT, pickupLead: 20 }).orders[0];
    expect(sent.fireAtTs).toBeUndefined();
    expect(lines(sent)[0].kitchenState).toBe('cooking');
  });

  it('computes the lead from the ticket average plus packing, rounded up to 5', () => {
    // No live tickets: last week's average (12.8) + 5 → 20.
    expect(pickupLeadMinutes([])).toBe(20);
    const o = order([], { queueType: 'pickup', readyAt: '7:00 PM' });
    expect(pickupFireAt(o, 20)).toBe(new Date(2026, 9, 7, 18, 40).getTime());
    expect(pickupFireAt(order([]), 20)).toBeNull();
  });
});

describe('courseDue', () => {
  const prevRun = [line('d_cbsoup', { sent: true, kitchenState: 'cleared', firedAt: T0, clearedAt: T0 })];

  it('expo mode fires the next course once the prior one is served', () => {
    const o = order([]);
    const cfg = withMode('expo');
    expect(courseDue(o, 2, prevRun, true, 0, cfg)).toBe(true);
    expect(courseDue(o, 2, prevRun, false, 0, cfg)).toBe(false);
  });

  it('dessert waits for the 15 minute backup', () => {
    const o = order([]);
    expect(courseDue(o, 3, prevRun, true, 0)).toBe(false);
    advance(COURSE_BACKUP_MIN * MIN);
    expect(courseDue(o, 3, prevRun, true, 0)).toBe(true);
  });

  it('manual coursing is the default: nothing fires on its own until the backup', () => {
    const o = order([]);
    expect(courseDue(o, 2, prevRun, true, 0)).toBe(false);
    advance(COURSE_BACKUP_MIN * MIN);
    expect(courseDue(o, 2, prevRun, true, 0)).toBe(true);
  });

  it('timed and manual modes', () => {
    const o = order([]);
    expect(courseDue(o, 2, prevRun, false, 5 * MIN, withMode('timer5'))).toBe(true);
    expect(courseDue(o, 2, prevRun, false, 5 * MIN, withMode('timer8'))).toBe(false);
    expect(courseDue(o, 2, prevRun, true, 0, withMode('manual'))).toBe(false);
    expect(courseDue(o, 2, [], false, 0, withMode('off'))).toBe(true);
    // Dessert waits even with Fire all.
    expect(courseDue(o, 3, [], false, 0, withMode('off'))).toBe(false);
  });
});

describe('pacingTick (dine-in)', () => {
  it('fires the held entrée once the soup course is run', () => {
    const { o, entree, dessert } = dinnerCheck();
    const cfg = withMode('expo');
    let s = sendOrder(stateOf(o), o.id);
    expect(pacingTick(s.orders, cfg)).toBe(s.orders);
    s = runCourse(s, o.id, 1);
    advance(5000);
    const fired = pacingTick(s.orders, cfg)[0];
    const byId = Object.fromEntries(lines(fired).map((i) => [i.id, i]));
    expect(byId[entree.id]).toMatchObject({ kitchenState: 'cooking', firedAt: T0 + 5000 });
    expect(byId[dessert.id].kitchenState).toBe('scheduled');
  });

  it('Fire all fires every course but dessert at send', () => {
    const { o, entree, dessert } = dinnerCheck();
    const cfg = withMode('off');
    const s = sendOrder(stateOf(o), o.id, { ...DEFAULT_CONTEXT, cfg });
    const byId = Object.fromEntries(lines(s.orders[0]).map((i) => [i.id, i]));
    expect(byId[entree.id].kitchenState).toBe('cooking');
    expect(byId[dessert.id].kitchenState).toBe('scheduled');
    // Dessert stays held on the pacing tick too.
    expect(pacingTick(s.orders, cfg)).toBe(s.orders);
  });
});

describe('course work and timeline helpers', () => {
  it('courseWork matches the prototype for every seeded order', () => {
    const got = Object.fromEntries(seedOrders().map((o) => [o.id, courseWork(o)]));
    expect(got).toEqual(prototype.courseWork);
  });

  it('lastRun and checkedIn', () => {
    const o = order([diner([line('d_cbsoup', { sent: true, course: 1, kitchenState: 'cleared', clearedAt: T0 })])]);
    const lr = lastRun(o);
    expect(lr).toEqual({ c: 1, at: T0 });
    expect(checkedIn(o, lr)).toBe(false);
    expect(checkedIn({ ...o, checkIns: [{ course: 1, at: T0 + 1, by: 'AA' }] }, lr)).toBe(true);
  });

  it('runCourse clears ready plates and loose sides; undo puts them back and re-holds what pacing fired', () => {
    const soup = line('d_cbsoup', { sent: true, course: 1, kitchenState: 'ready', firedAt: T0 });
    const entree = line('d_peach', { sent: true, course: 2, kitchenState: 'scheduled', firedAt: T0 });
    const o = order([diner([soup, entree])]);
    expect(runsLine(soup, 1)).toBe(true);
    const undo = runUndoSnapshot(o, 1);
    let s = runCourse(stateOf(o), o.id, 1);
    advance(1000);
    s = { ...s, orders: pacingTick(s.orders, withMode('expo')) };
    expect(lines(s.orders[0]).map((i) => i.kitchenState)).toEqual(['cleared', 'cooking']);
    s = undoRunCourse(s, o.id, undo);
    expect(lines(s.orders[0]).map((i) => i.kitchenState)).toEqual(['ready', 'scheduled']);
  });
});

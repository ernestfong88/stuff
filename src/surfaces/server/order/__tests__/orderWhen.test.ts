import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { diner, freezeClock, line, order } from '../../../../domain/__tests__/helpers';
import { menuDayOf, menuFor, setMenuForDay, todayCatalog } from '../../../../data';
import { parseIsoDay } from '../../../../domain/menuCycle';
import { aheadDayLabel, dayBefore, isoDate, pickupFireAt } from '../../../../domain/pickup';
import { DEFAULT_CONTEXT, sendOrder } from '../../../../domain/diningActions';
import { kioskMenu } from '../../../../domain/kioskMenu';
import type { Order, QueueType } from '../../../../domain/types';
import { venueServing } from '../../../../store/venueMenu';
import { ordersToday } from '../../../../store/eightySix';
import { getBo, liveOn } from '../../../backoffice/menus/data';
import { menuSections, orderMenuDate } from '../menu/menuCatalog';
import { bookableDays, dayChipLabel, dayTimes, landing, menuWords, offMenuLines, type TimeContext } from '../queue/orderWhen';

beforeEach(() => {
  freezeClock();
  setMenuForDay((date) => liveOn(date));
});
afterEach(() => {
  setMenuForDay(null);
  vi.useRealTimers();
});

const noon = (date: string) => parseIsoDay(date)!.getTime() + 12 * 3_600_000;
const specialNames = (date: string | null, meal: 'Lunch' | 'Dinner') =>
  Object.values(menuFor('sequoia', date)[meal])
    .flat()
    .filter((i) => i.special)
    .map((i) => i.name)
    .sort();

/** What Back Office has on a cycle day for a meal, by recipe name. */
function placedOn(date: string, meal: string): string[] {
  const s = getBo();
  const serve = venueServing(s.venues.find((v) => v.room === 'sequoia' && v.active)!, noon(date), s.menus, s.grid);
  return s.grid
    .filter((g) => g.menuId === serve.cycleId && g.day === serve.day && g.meal === meal)
    .map((g) => s.recipes.find((r) => r.id === g.recipeId)!.name)
    .sort();
}

describe('a later day’s menu', () => {
  it('leaves today’s menu exactly as it was', () => {
    expect(menuFor('sequoia', isoDate(0))).toBe(menuFor('sequoia'));
    expect(menuFor('bistro', null)).toBe(menuFor('bistro'));
    expect(menuDayOf('sequoia', isoDate(0))).toBe(menuDayOf('sequoia'));
  });

  it('serves tomorrow’s cycle day and its specials, worked out the way today’s are', () => {
    const tomorrow = isoDate(1);
    const s = getBo();
    const serve = venueServing(s.venues.find((v) => v.room === 'sequoia' && v.active)!, noon(tomorrow), s.menus, s.grid);
    expect(menuDayOf('sequoia', tomorrow)).toBe(serve.day);
    expect(specialNames(tomorrow, 'Lunch')).toEqual(placedOn(tomorrow, 'Lunch'));
    // Each day its own: the day after has that day's.
    expect(specialNames(isoDate(2), 'Lunch')).toEqual(placedOn(isoDate(2), 'Lunch'));
    expect(specialNames(isoDate(2), 'Lunch')).not.toEqual(specialNames(tomorrow, 'Lunch'));
    // The Entrees tab heads with that day's specials.
    const secs = menuSections('Lunch', 'Entrees', { drinkGroup: 'Non-Alcoholic', room: 'sequoia', date: tomorrow });
    expect(secs[0]).toMatchObject({ kind: 'specials', label: "Tomorrow's specials" });
  });

  it('keeps each venue on its own menu', () => {
    const tomorrow = isoDate(1);
    const bistro = Object.values(menuFor('bistro', tomorrow).Lunch).flat();
    expect(bistro.length).toBeGreaterThan(0);
    expect(bistro.some((i) => i.special)).toBe(false);
  });

  it('falls back to today’s until Back Office’s menu model has loaded', () => {
    setMenuForDay(null);
    expect(menuFor('sequoia', isoDate(1))).toBe(menuFor('sequoia'));
  });

  it('gives the kiosk tomorrow’s menu for a tomorrow order', () => {
    const tomorrow = isoDate(1);
    const names = (m: ReturnType<typeof kioskMenu>) => m.specials.map((i) => i.name).sort();
    expect(names(kioskMenu('Lunch', () => false, tomorrow)).every((n) => specialNames(tomorrow, 'Lunch').includes(n))).toBe(true);
    expect(todayCatalog(null, tomorrow)).not.toBe(todayCatalog(null));
    expect(names(kioskMenu('Lunch', () => false, isoDate(2)))).not.toEqual(names(kioskMenu('Lunch', () => false, tomorrow)));
  });
});

describe('an order’s day', () => {
  const pu = (extra: Partial<Order> = {}) =>
    order([diner([])], { queueType: 'pickup', tableId: undefined, meal: 'Lunch', ...extra }) as Order & { queueType: QueueType };
  const ctx: TimeContext = { nowMinute: 18 * 60, cut: 45, data: { orders: [], history: [], assoc: [] } };

  it('books today or tomorrow, said plainly', () => {
    expect(bookableDays()).toEqual([isoDate(0), isoDate(1)]);
    expect(bookableDays().map(dayChipLabel)).toEqual(['Today', 'Tomorrow']);
    expect(aheadDayLabel(isoDate(2))).toMatch(/^[A-Z][a-z]{2} \d{1,2}\/\d{1,2}$/);
    expect(aheadDayLabel(isoDate(0))).toBe('');
    expect(menuWords(isoDate(1), 'Lunch')).toBe("tomorrow's lunch menu");
    expect(dayBefore(Date.now() + 86_400_000)).toBe('tomorrow ');
    expect(dayBefore(Date.now())).toBe('');
  });

  it('orders from the later day’s menu only when it is booked ahead', () => {
    expect(orderMenuDate(pu())).toBeNull();
    expect(orderMenuDate(pu({ forDate: isoDate(0) }))).toBeNull();
    expect(orderMenuDate(pu({ forDate: isoDate(1) }))).toBe(isoDate(1));
  });

  it('offers every meal’s ranges on a later day, and only what is left today', () => {
    const today = dayTimes(pu(), isoDate(0), ctx);
    expect(today.map((m) => m.meal)).toEqual(['Dinner']);
    expect(today[0].times.every((t) => t.s >= 18 * 60 + 45)).toBe(true);
    expect(dayTimes(pu(), isoDate(1), ctx).map((m) => m.meal)).toEqual(['Breakfast', 'Lunch', 'Dinner']);
  });

  it('lands on the same meal and time when it can, else the first open one', () => {
    const tomorrow = dayTimes(pu(), isoDate(1), ctx);
    expect(landing({ meal: 'Lunch', readyAt: '12:15 PM' }, tomorrow, {})).toEqual({ meal: 'Lunch', readyAt: '12:15 PM' });
    expect(landing({ meal: 'Lunch', readyAt: '12:15 PM' }, tomorrow, { meal: 'Dinner' })).toEqual({ meal: 'Dinner', readyAt: '4:30 PM' });
    // Today at 6 PM lunch is over: dinner's first open range.
    expect(landing({ meal: 'Lunch', readyAt: '12:15 PM' }, dayTimes(pu(), isoDate(0), ctx), {}).meal).toBe('Dinner');
    expect(landing({ meal: 'Lunch', readyAt: undefined }, [], {})).toEqual({ meal: 'Lunch', readyAt: null });
  });

  it('finds the unsent lines a new menu doesn’t have, never sent ones or sides', () => {
    const lunchSpecial = Object.values(menuFor('sequoia').Lunch)
      .flat()
      .find((i) => i.special)!;
    const coffee = line('l_coffee');
    const special = line(lunchSpecial.id);
    const side = line(lunchSpecial.id, { parentId: special.id });
    const sent = line(lunchSpecial.id, { sent: true });
    const o = order([diner([coffee, special, side, sent])], { queueType: 'pickup', tableId: undefined, meal: 'Lunch' });
    const off = offMenuLines(o, 'Lunch', isoDate(1)).map((x) => x.line.id);
    if (!specialNames(isoDate(1), 'Lunch').includes(lunchSpecial.name)) expect(off).toEqual([special.id]);
    expect(offMenuLines(o, 'Lunch', isoDate(0))).toEqual([]);
    expect(offMenuLines({ ...o, assoc: true }, 'Dinner', isoDate(1))).toEqual([]);
  });

  it('never reaches the kitchen today, and doesn’t count toward today’s 86 portions', () => {
    const o = order([diner([line('d_peach')])], { queueType: 'pickup', tableId: undefined, readyAt: '5:00 PM', forDate: isoDate(1) });
    const fire = pickupFireAt(o, 20)!;
    expect(fire).toBeGreaterThan(Date.now() + 12 * 3_600_000);
    const sent = sendOrder({ orders: [o], history: [], assocOrders: [] }, o.id, DEFAULT_CONTEXT).orders[0];
    expect(sent.diners[0].items.every((i) => i.kitchenState === 'scheduled')).toBe(true);
    expect(sent.fireAtTs).toBe(fire);
    expect(ordersToday([o, order([])], []).map((x) => x.id)).not.toContain(o.id);
  });
});

/**
 * When a pick up or delivery is for: its day, its meal and its 15 minute
 * range. The day and the range's meal decide the menu the order is taken
 * from (that day's cycle specials, that meal's à la carte), so changing
 * either can leave lines on the order that the new menu doesn't have; the
 * screen asks before keeping or removing them (see useOrderWhen).
 */
import { getItem } from '../../../../data';
import { MEALS } from '../../../../domain/mealPeriods';
import { aheadDayLabel, isoDate } from '../../../../domain/pickup';
import type { AssocMeal, MealName, Order, OrderLine, QueueType } from '../../../../domain/types';
import { now } from '../../../../lib/clock';
import { getSetting } from '../../../../store/serviceConfig';
import { onMealMenu, orderMenuRoom } from '../menu/menuCatalog';
import { cutoffMinutes, windowLoad, windowsFor, type PickupWindow, type WindowLoad } from './pickupWindows';

/**
 * How many days past today a server can book a pick up or delivery for.
 * Back Office has no setting for booking further ahead, so it is tomorrow,
 * the same as the lobby kiosk once today's last range has closed.
 */
export const DAYS_AHEAD = 1;

/** The days a server can book for: today, then the next DAYS_AHEAD days ("YYYY-MM-DD"). */
export function bookableDays(ahead = DAYS_AHEAD): string[] {
  return Array.from({ length: ahead + 1 }, (_, i) => isoDate(i));
}

/** "Today", "Tomorrow" or "Fri 10/10". */
export const dayChipLabel = (date: string): string => aheadDayLabel(date) || 'Today';

/** "today's lunch menu", "tomorrow's dinner menu", "the Fri 10/10 lunch menu". */
export function menuWords(date: string, meal: MealName): string {
  const m = meal.toLowerCase();
  const ahead = aheadDayLabel(date);
  if (!ahead) return `today's ${m} menu`;
  return ahead === 'Tomorrow' ? `tomorrow's ${m} menu` : `the ${ahead} ${m} menu`;
}

export interface TimeChoice extends PickupWindow {
  load?: WindowLoad;
}

export interface MealTimes {
  meal: MealName;
  times: TimeChoice[];
}

export interface TimeContext {
  /** Minutes since midnight now, on the demo clock. */
  nowMinute: number;
  /** Orders close this many minutes before a range starts. */
  cut: number;
  data: { orders: Order[]; history: Order[]; assoc: AssocMeal[] };
}

/** Now, the order's cutoff (an associate meal closes on the Associate Meals cutoff) and what is booked. */
export function timeContext(o: Pick<Order, 'assoc'>, data: TimeContext['data']): TimeContext {
  const assocCut = Number(getSetting('am.cut') ?? NaN);
  const d = new Date(now());
  return { nowMinute: d.getHours() * 60 + d.getMinutes(), cut: o.assoc && Number.isFinite(assocCut) ? assocCut : cutoffMinutes(), data };
}

/**
 * The ranges a venue offers on a day, by meal: every meal with a range left
 * (today, ranges still taking orders). Each knows how full it is.
 */
export function dayTimes(o: Pick<Order, 'id' | 'room'> & { queueType: QueueType }, date: string, ctx: TimeContext): MealTimes[] {
  const today = date <= isoDate(0);
  return MEALS.map((meal) => ({
    meal,
    times: windowsFor(o.queueType, o.room, meal)
      .filter((w) => !today || w.s >= ctx.nowMinute + ctx.cut)
      .map((w) => ({ ...w, load: windowLoad(o.queueType, o.room, w.s, date, o.id, ctx.data) })),
  })).filter((m) => m.times.length > 0);
}

const openTimes = (m: MealTimes | undefined) => (m ? m.times.filter((t) => !t.load?.full) : []);

/**
 * Where the order lands when its day or meal changes: the meal asked for,
 * else the order's meal when it still has a time open that day, else the
 * first meal that does; the time it has when that is still open, else that
 * meal's first open time (null when it has none).
 */
export function landing(
  current: Pick<Order, 'meal' | 'readyAt'>,
  times: MealTimes[],
  want: { meal?: MealName },
): { meal: MealName; readyAt: string | null } {
  const has = (meal: MealName) => openTimes(times.find((m) => m.meal === meal)).length > 0;
  const meal = want.meal ?? (has(current.meal) ? current.meal : (times.find((m) => has(m.meal))?.meal ?? current.meal));
  const open = openTimes(times.find((m) => m.meal === meal));
  const keep = open.find((t) => t.at === current.readyAt);
  return { meal, readyAt: keep?.at ?? open[0]?.at ?? null };
}

export interface OffMenuLine {
  dinerId: string;
  line: OrderLine;
  name: string;
}

/**
 * Lines not yet sent that a day's meal menu doesn't have (its sides go with
 * the plate). An associate's meal orders from the associate menu, so it is
 * not checked here.
 */
export function offMenuLines(o: Order, meal: MealName, date: string): OffMenuLine[] {
  if (o.assoc) return [];
  const room = orderMenuRoom(o);
  const ahead = date > isoDate(0) ? date : null;
  const out: OffMenuLine[] = [];
  for (const d of o.diners)
    for (const line of d.items) {
      if (line.sent || line.cancelled || line.parentId) continue;
      if (onMealMenu(meal, line.itemId, room, ahead)) continue;
      out.push({ dinerId: d.id, line, name: getItem(line.itemId)?.name ?? 'An item' });
    }
  return out;
}

/** Anything on the order has gone to the kitchen: its day is set. */
export const anySent = (o: Order): boolean => o.diners.some((d) => d.items.some((l) => l.sent && !l.cancelled));

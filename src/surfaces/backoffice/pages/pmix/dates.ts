/** Dates on P-Mix are "days back" from today (1 = yesterday), shown as ISO dates in the pickers. */
import { DAY, startOfToday } from '../../../../lib/clock';
import { isoOf } from '../../../../lib/dates';

export function isoDaysBack(back: number, todayStart: number = startOfToday()): string {
  // Noon avoids a daylight saving hour pushing the date across midnight.
  return isoOf(todayStart - back * DAY + 12 * 3_600_000);
}

export function daysBackOf(iso: string, todayStart: number = startOfToday()): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((todayStart - new Date(y, m - 1, d).getTime()) / DAY);
}

/** "10/6" */
export function shortDate(back: number, todayStart: number = startOfToday()): string {
  const d = new Date(todayStart - back * DAY + 12 * 3_600_000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function weekdayOf(back: number, style: 'long' | 'short' = 'long', todayStart: number = startOfToday()): string {
  return new Date(todayStart - back * DAY + 12 * 3_600_000).toLocaleDateString('en-US', { weekday: style });
}

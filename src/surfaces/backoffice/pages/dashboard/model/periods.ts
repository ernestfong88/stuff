/**
 * The dashboard compares the last N days (7, 14 or 28) with the N days
 * before, and shows 8 such periods on the trend charts.
 */

export type RangeDays = 7 | 14 | 28;

export interface Period {
  /** Start (inclusive, local midnight). */
  a: number;
  /** End (exclusive). */
  b: number;
}

/** Period k back: 0 is the last N days ending today, 1 the N days before that ... */
export function period(k: number, n: RangeDays, todayStart: number): Period {
  const b = addDays(todayStart, 1 - n * k);
  return { a: addDays(b, -n), b };
}

/** Local midnight `days` after `t` (a calendar step, safe across daylight saving). */
export function addDays(t: number, days: number): number {
  const d = new Date(t);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface DaySlot {
  /** Local midnight. */
  a: number;
  i: number;
  today: boolean;
}

/** The days of the current period, oldest first; the last one is today. */
export function currentDays(n: RangeDays, todayStart: number): DaySlot[] {
  const { a } = period(0, n, todayStart);
  return Array.from({ length: n }, (_, i) => ({ a: addDays(a, i), i, today: i === n - 1 }));
}

const md = (t: number) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

/**
 * Label under a day's bar: weekdays for a week; for 14 and 28 days every
 * second or seventh date counted back from today, so the axis stays legible.
 */
export function dayLabel(slot: DaySlot, n: RangeDays): string {
  if (slot.today) return 'Today';
  if (n <= 7) return new Date(slot.a).toLocaleDateString('en-US', { weekday: 'short' });
  const step = n <= 14 ? 2 : 7;
  return (n - 1 - slot.i) % step === 0 ? md(slot.a) : '';
}

/** Label under a period's bar on the 8-period trend: "Last 7" for the current one, else its last day. */
export function periodLabel(k: number, n: RangeDays, todayStart: number): string {
  if (k === 0) return `Last ${n}`;
  return md(addDays(period(k, n, todayStart).b, -1));
}

/** Weekday, month and day: "Monday, October 5". */
export function longDay(t: number): string {
  return new Date(t).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

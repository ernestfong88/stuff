/** Calendar days in local time. */

/** "2026-10-07": the local calendar day of a date or a time (ms). */
export function isoOf(t: Date | number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local midnight (ms) of the day of `t`, or of the day `days` later (a calendar step, safe across daylight saving). */
export function dayStart(t: Date | number, days = 0): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

/** The same time of day `days` calendar days later. */
export function addDays(d: Date | number, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

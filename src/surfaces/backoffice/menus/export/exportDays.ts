/**
 * Which days and weeks Menu Export offers: today and the next few days of
 * the running cycle, and this week and next. It stops at the end of the
 * cycle, since the dates past it belong to the next run.
 */

/** Cycle days from today on, at most `count`, never past the end of the cycle. */
export function exportDays(today: number, len: number, count = 7): number[] {
  if (today < 1 || len < 1) return [];
  return Array.from({ length: count }, (_, i) => today + i).filter((d) => d <= len);
}

/** The week running now (0 based) and the one after it, when the cycle has it. */
export function exportWeeks(current: number, len: number): number[] {
  const weeks = Math.ceil(len / 7);
  return [current, current + 1].filter((w) => w >= 0 && w < weeks);
}

/** "Today", "Tomorrow", then "Fri 10/9". */
export function dayLabel(offset: number, date: Date): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${date.getMonth() + 1}/${date.getDate()}`;
}

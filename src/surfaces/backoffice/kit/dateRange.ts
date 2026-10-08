/**
 * Date range filter for back office lists (Charge Approval, Order History):
 * a preset (Today, Last 7 days ...) or a custom from/to, worked out in the
 * community's local days. Pure, so the pages and tests share it.
 */

export type DatePreset = 'all' | 'today' | 'yesterday' | 'last7' | 'month' | 'custom';

export interface DateRange {
  preset: DatePreset;
  /** Custom range only: first and last day, as "YYYY-MM-DD" (either may be blank for an open end). */
  from?: string;
  to?: string;
}

export const ANY_DATE: DateRange = { preset: 'all' };

export const DATE_PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: 'all', label: 'Any date' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

/** Local midnight `days` days after the day of `t` (DST safe). */
function dayStart(t: number, days = 0): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

/** "2026-10-08" → local midnight that day; null when blank or malformed. */
export function parseDay(value: string | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null;
}

/** Local day of `t` as "YYYY-MM-DD", for a date input. */
export function dayValue(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The range as [start, end) in ms, either end null when open. Null for
 * "Any date". A custom range given backwards is read the right way round.
 */
export function rangeBounds(r: DateRange, at: number): { start: number | null; end: number | null } | null {
  const today = dayStart(at);
  switch (r.preset) {
    case 'today':
      return { start: today, end: dayStart(at, 1) };
    case 'yesterday':
      return { start: dayStart(at, -1), end: today };
    case 'last7':
      return { start: dayStart(at, -6), end: dayStart(at, 1) };
    case 'month': {
      const d = new Date(at);
      return { start: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), end: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() };
    }
    case 'custom': {
      let from = parseDay(r.from);
      let to = parseDay(r.to);
      if (from != null && to != null && from > to) [from, to] = [to, from];
      if (from == null && to == null) return null;
      return { start: from, end: to == null ? null : dayStart(to, 1) };
    }
    default:
      return null;
  }
}

/** Whether time `t` falls in the range (always true for "Any date" or an empty custom range). */
export function inRange(t: number, r: DateRange, at: number): boolean {
  const b = rangeBounds(r, at);
  if (!b) return true;
  return (b.start == null || t >= b.start) && (b.end == null || t < b.end);
}

/** Whether the range narrows anything. */
export function isRangeSet(r: DateRange): boolean {
  return r.preset !== 'all' && !(r.preset === 'custom' && parseDay(r.from) == null && parseDay(r.to) == null);
}

/** Switch preset; picking Custom starts from the last 7 days so both boxes have a date. */
export function withPreset(r: DateRange, preset: DatePreset, at: number): DateRange {
  if (preset !== 'custom') return { preset };
  return { preset, from: r.from || dayValue(dayStart(at, -6)), to: r.to || dayValue(at) };
}

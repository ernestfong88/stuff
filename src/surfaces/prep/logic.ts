/** Pure helpers for Production Prep. */
import { cleaningStatus, isoOf, shortName, sortForShift, type CleaningSignOff, type CleaningStatus, type CleaningTask } from '../../domain/cleaning';
import { cleaningSign, cleaningTasksFor, type CleaningState } from '../../store/cleaning';
import type { CheckHow } from '../../store/production';
import { TEMP_MEALS } from '../../domain/tempLog';
import { mealLog, type TempLogState } from '../../store/tempLog';

const FRACTIONS: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

/**
 * A scaled ingredient amount rounded to the nearest quarter, written the way
 * a cook reads it: 3, 1½, ¾. Very small amounts never round down to nothing.
 */
export function formatQuantity(q: number): string {
  const quarters = Math.max(1, Math.round(q * 4)) / 4;
  const whole = Math.floor(quarters);
  const frac = FRACTIONS[quarters - whole] ?? '';
  return (whole > 0 ? String(whole) : '') + frac || '0';
}

/**
 * A scaled amount in the unit a cook would measure it in, to the nearest
 * quarter: 70 tbsp is "4½ cups", 70 oz is "4 lb 6 oz", 210 fl oz is "6½ qt".
 * Other units, and amounts too small to move up a unit, stay as they are.
 */
export function kitchenAmount(q: number, unit: string): string {
  const u = unit.trim().toLowerCase();
  const fmt = (n: number, name: string) => `${formatQuantity(n)}${name ? ' ' + name : ''}`;
  if (u === 'tsp' && q >= 3) return kitchenAmount(q / 3, 'tbsp');
  if (u === 'tbsp' && q >= 16) return fmt(q / 16, 'cups');
  if ((u === 'fl oz' || u === 'floz') && q >= 32) return fmt(q / 32, 'qt');
  if ((u === 'fl oz' || u === 'floz') && q >= 8) return fmt(q / 8, q / 8 === 1 ? 'cup' : 'cups');
  if (u === 'oz' && q >= 16) {
    const lb = Math.floor(q / 16);
    const oz = Math.round(q - lb * 16);
    return oz ? `${lb} lb ${oz} oz` : `${lb} lb`;
  }
  return fmt(q, unit);
}

/** Scale factor from the recipe's base batch to the amount to make, e.g. "×5". */
export function formatScale(make: number, base: number): string {
  return '×' + formatQuantity(make / base);
}

export const CHECK_LABEL: Record<CheckHow, string> = {
  done: 'Done',
  stocked: 'Stocked',
  backup: 'Backup made',
};

/** "Today 2:45 PM", "Yesterday 7:10 AM" or "Mon Oct 5 7:10 AM" relative to `nowMs`. */
export function noteWhen(at: number, nowMs: number): string {
  const startOf = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((startOf(nowMs) - startOf(at)) / 86_400_000);
  const time = new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  const day = new Date(at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
  return `${day} ${time}`;
}

/** "Wed Oct 7" for a day offset from `base`. */
export function dayLabel(base: Date, offset: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
}

/** "Adriana Alvarado" → "A. Alvarado", the way the kitchen signs its work. */
export const signature = shortName;

export interface CleaningRow {
  task: CleaningTask;
  sign: CleaningSignOff | null;
  status: CleaningStatus;
}

/** Today's daily cleaning and this week's weekly cleaning at a kitchen, each with where it stands, and how many are signed off. */
export function cleaningToday(state: CleaningState, venueId: string, nowMs: number): { iso: string; rows: CleaningRow[]; done: number } {
  const iso = isoOf(new Date(nowMs));
  const rows = sortForShift(cleaningTasksFor(state, venueId)).map((task) => {
    const sign = cleaningSign(state, venueId, task, iso, nowMs);
    return { task, sign, status: cleaningStatus(task, iso, sign, nowMs) };
  });
  return { iso, rows, done: rows.filter((r) => r.sign).length };
}

/** Temperature checks overdue at a kitchen today, across its meals. */
export function tempOverdue(state: TempLogState, venueId: string, nowMs: number): number {
  const iso = isoOf(new Date(nowMs));
  return TEMP_MEALS.reduce(
    (n, meal) =>
      n +
      mealLog(state, venueId, iso, meal, nowMs)
        .dishes.flatMap((d) => d.cells)
        .filter((c) => c.status === 'overdue').length,
    0,
  );
}

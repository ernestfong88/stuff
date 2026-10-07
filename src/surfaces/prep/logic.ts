/** Pure helpers for Production Prep. */
import type { CheckHow, PrepMeal } from '../../store/production';

/** The meal being served at this hour: breakfast before 10, lunch until 3, then dinner. */
export function mealAt(hour: number): PrepMeal {
  if (hour < 10) return 'Breakfast';
  if (hour < 15) return 'Lunch';
  return 'Dinner';
}

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
export function signature(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

/** Time labels on the kitchen screens. */
import { formatMinuteOfDay as fmt } from '../../lib/format';

/**
 * A promised time is a 15 minute window: "4:45 PM" → "4:45 to 5:00 PM"
 * ("11:50 AM to 12:05 PM" across noon). Anything else is returned as is.
 */
export function pickupWindow(at: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(at ?? '');
  if (!m) return at ?? '';
  const start = ((+m[1] % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + +m[2];
  const a = fmt(start);
  const b = fmt(start + 15);
  return a.slice(-2) === b.slice(-2) ? a.slice(0, -3) + ' to ' + b : a + ' to ' + b;
}

/** "Starters", "Entrees", "Desserts", else "Course 4". */
export function courseWord(c: number): string {
  return c === 1 ? 'Starters' : c === 2 ? 'Entrees' : c === 3 ? 'Desserts' : 'Course ' + c;
}

/**
 * Associate Meals lists pick up times as a few spans ("11:00 AM to 1:30 PM")
 * instead of every 15 minute range.
 */
import { minutesLabel } from '../../../domain/assocMeals/windows';

/** Join 15 minute ranges that follow each other into spans of [start, end] minutes, keeping their order. */
export function rangeSpans(starts: number[], step = 15): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const s of starts) {
    const last = spans[spans.length - 1];
    if (last && s >= last[0] && s <= last[1]) last[1] = Math.max(last[1], s + step);
    else spans.push([s, s + step]);
  }
  return spans;
}

/** "11:00 AM to 1:30 PM", or "None" when there are no ranges. */
export function spansText(starts: number[]): string {
  const spans = rangeSpans(starts);
  return spans.length ? spans.map(([a, b]) => `${minutesLabel(a)} to ${minutesLabel(b)}`).join(', ') : 'None';
}

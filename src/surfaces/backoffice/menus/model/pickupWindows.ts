/**
 * Pick up ranges a venue offers, for the printed order form. Every booking
 * is a 15 minute range such as 5:00 to 5:15 PM; Back Office ticks the
 * ranges each venue offers (Pick Up Windows), stored in the service config
 * as minutes after midnight.
 */
const DAY: [number, number] = [360, 1320];
const MEAL_SPAN: Record<string, [number, number]> = { Breakfast: [360, 660], Lunch: [660, 960], Dinner: [960, 1320] };
const DEFAULT_SPANS: Array<[number, number]> = [
  [450, 570],
  [660, 810],
  [990, 1200],
];

function defaultSlots(): number[] {
  return DEFAULT_SPANS.flatMap(([a, b]) => {
    const out: number[] = [];
    for (let s = a; s < b; s += 15) out.push(s);
    return out;
  });
}

/** "5:15 PM" for minutes after midnight. */
export function minutesLabel(v: number): string {
  const h = Math.floor(v / 60) % 24;
  const m = v % 60;
  return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h >= 12 ? ' PM' : ' AM');
}

/** Start minutes of the pick up ranges a venue offers at a meal. */
export function pickupSlots(grid: unknown, room: string, meal: string): number[] {
  const span = MEAL_SPAN[meal];
  if (!span) return [];
  const own = (grid as Record<string, Record<string, unknown>> | undefined)?.[room]?.pickup;
  const slots = Array.isArray(own)
    ? own.filter((x): x is number => typeof x === 'number' && x % 15 === 0 && x >= DAY[0] && x < DAY[1]).sort((a, b) => a - b)
    : defaultSlots();
  return slots.filter((x) => x >= span[0] && x < span[1]);
}

/** "11:00 AM to 1:30 PM": from the first range's start to the last one's end. */
export function pickupSpan(grid: unknown, room: string, meal: string): string {
  const s = pickupSlots(grid, room, meal);
  return s.length ? minutesLabel(s[0]) + ' to ' + minutesLabel(s[s.length - 1] + 15) : '';
}

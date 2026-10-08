/**
 * Checks before a floor plan is saved. Hosts, servers and order history find
 * a table by its label, so every table needs one, and no two can share it.
 */
import type { PlanItem } from '../../../store/floorLayout';

/** What is wrong with a table's label, by table id: blank, or the same as another table's. */
export function labelProblems(items: readonly PlanItem[]): Record<string, 'blank' | 'duplicate'> {
  const seats = items.filter((t) => t.type === 'seat');
  const count = new Map<string, number>();
  for (const t of seats) {
    const k = t.label.trim().toLowerCase();
    if (k) count.set(k, (count.get(k) ?? 0) + 1);
  }
  const out: Record<string, 'blank' | 'duplicate'> = {};
  for (const t of seats) {
    const k = t.label.trim().toLowerCase();
    if (!k) out[t.id] = 'blank';
    else if ((count.get(k) ?? 0) > 1) out[t.id] = 'duplicate';
  }
  return out;
}

/** Pairs of items whose boxes cross (touching edges is fine). Only tables count, against tables and walls. */
export function overlapPairs(items: readonly PlanItem[]): Array<[PlanItem, PlanItem]> {
  const pairs: Array<[PlanItem, PlanItem]> = [];
  const crosses = (a: PlanItem, b: PlanItem) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
  items.forEach((a, i) => {
    for (const b of items.slice(i + 1)) {
      if ((a.type === 'seat' || b.type === 'seat') && crosses(a, b)) pairs.push(a.type === 'seat' ? [a, b] : [b, a]);
    }
  });
  return pairs;
}

/** "SQ 13 and SQ 8", "SQ 13 and a wall", with "and 2 more" past the first three. */
export function overlapText(pairs: ReadonlyArray<[PlanItem, PlanItem]>): string {
  const name = (t: PlanItem) => (t.type === 'wall' ? 'a wall' : t.label);
  const list = pairs.slice(0, 3).map(([a, b]) => `${name(a)} and ${name(b)}`);
  const more = pairs.length - list.length;
  return list.join(', ') + (more > 0 ? `, and ${more} more` : '');
}

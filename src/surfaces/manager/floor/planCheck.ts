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

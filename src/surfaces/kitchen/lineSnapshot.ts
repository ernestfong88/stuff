/**
 * Undo for a bump: remember where each plate was before it moved, so an
 * Undo puts back exactly those plates and nothing else on the check.
 */
import type { KitchenState, Order } from '../../domain/types';

export interface LineState {
  id: string;
  state: KitchenState;
}

/** The kitchen state of these lines on the check, or of every line not yet on the table. */
export function snapshotLines(o: Order, ids?: readonly string[]): LineState[] {
  const all = o.diners.flatMap((d) => d.items);
  const picked = ids ? all.filter((i) => ids.includes(i.id)) : all.filter((i) => i.sent && i.kitchenState !== 'cleared');
  return picked.map((i) => ({ id: i.id, state: i.kitchenState }));
}

/** Lines whose state is different now from the snapshot: what an undo must put back. */
export function linesToRestore(before: readonly LineState[], after: Order): LineState[] {
  const now = new Map(after.diners.flatMap((d) => d.items).map((i) => [i.id, i.kitchenState]));
  return before.filter((b) => now.has(b.id) && now.get(b.id) !== b.state);
}

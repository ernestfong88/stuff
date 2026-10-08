/**
 * The saved floor plan layouts, on their own so the data layer can read them
 * (getTable) without importing the floor plan helpers, which import the data.
 */
import type { FloorTable } from '../domain/types';
import { createSharedStore } from '../lib/sharedStore';

/** A table or wall on a plan. Walls are drawn but never seated. */
export interface PlanItem extends FloorTable {
  type: 'seat' | 'wall';
}

/** Saved layouts by room key. */
export type SavedLayouts = Record<string, PlanItem[]>;

export const layoutStore = createSharedStore<SavedLayouts>({}, {
  persistKey: 'kisco_floorplan_v1',
  channel: 'kisco-floorplan',
});

type SavedSeat = PlanItem & { room: string };

/** Every saved seat by id, built once per saved layouts object (the store replaces it on each change). */
const seatIndex = new WeakMap<SavedLayouts, Map<string, SavedSeat>>();

function seatsOf(saved: SavedLayouts): Map<string, SavedSeat> {
  let index = seatIndex.get(saved);
  if (!index) {
    index = new Map();
    for (const [room, items] of Object.entries(saved))
      for (const x of items) if (x.type === 'seat' && !index.has(x.id)) index.set(x.id, { ...x, room });
    seatIndex.set(saved, index);
  }
  return index;
}

/** A seat on a saved layout, with its room, or undefined when no saved layout has it. Treat it as read only. */
export function savedTable(id: string, saved: SavedLayouts = layoutStore.get()): SavedSeat | undefined {
  return seatsOf(saved).get(id);
}

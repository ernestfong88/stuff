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

/** A seat on a saved layout, with its room, or undefined when no saved layout has it. */
export function savedTable(id: string, saved: SavedLayouts = layoutStore.get()): (PlanItem & { room: string }) | undefined {
  for (const [room, items] of Object.entries(saved)) {
    const t = items.find((x) => x.id === id && x.type === 'seat');
    if (t) return { ...t, room };
  }
  return undefined;
}

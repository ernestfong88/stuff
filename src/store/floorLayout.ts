/**
 * Floor plan layouts. Back Office, Floor Plans arranges the tables of each
 * room; the host floor, the manager floor and the reservation table picker
 * all draw from here, so a moved table moves everywhere at once.
 *
 * Positions and sizes are percentages of the plan, like the seed rooms, so
 * a plan scales to any screen. A room nobody has edited uses the seed.
 */
import { useCallback, useMemo } from 'react';
import { rooms } from '../data';
import { tableName } from '../domain/orders';
import type { FloorBand, FloorTable, Order } from '../domain/types';
import { createSharedStore, useShared } from '../lib/sharedStore';

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

export interface RoomPlan {
  key: string;
  name: string;
  bands: FloorBand[];
  /** Tables and walls, in drawing order. */
  items: PlanItem[];
  /** Only the tables guests sit at. */
  tables: PlanItem[];
}

/** The seed tables of a room that sit on the plan (not the pick up / delivery stations). */
export function seedItems(room: string): PlanItem[] {
  return (rooms[room]?.tables ?? []).filter((t) => t.type === 'seat').map((t) => ({ ...t, type: 'seat' as const }));
}

export function roomPlan(room: string, saved: SavedLayouts): RoomPlan {
  const items = saved[room] ?? seedItems(room);
  return {
    key: room,
    name: rooms[room]?.name ?? room,
    bands: rooms[room]?.bands ?? [],
    items,
    tables: items.filter((t) => t.type === 'seat'),
  };
}

/** The plan of a room, live. */
export function useRoomPlan(room: string): RoomPlan {
  const saved = useShared(layoutStore);
  return useMemo(() => roomPlan(room, saved), [room, saved]);
}

/** Save a room's layout (Back Office). */
export function saveRoomLayout(room: string, items: PlanItem[]): void {
  layoutStore.set((s) => ({ ...s, [room]: items }));
}

/** Go back to the seed layout of a room. */
export function resetRoomLayout(room: string): void {
  layoutStore.set((s) => {
    const next = { ...s };
    delete next[room];
    return next;
  });
}

/** __kInVenue: by the floor plan, not order.room (seeded Evergreen checks say bistro). */
export function inPlan(o: Order, plan: RoomPlan): boolean {
  return !!o.tableId && plan.tables.some((t) => t.id === o.tableId);
}

/** Checks at a table, lettered checks in order. */
export function checksAt(live: Order[], tableId: string): Order[] {
  return live
    .filter((o) => o.tableId === tableId)
    .sort((a, b) => (a.checkTag || '').localeCompare(b.checkTag || '') || a.openedAt - b.openedAt);
}

/**
 * __kTableName with the saved layouts first, so a table added or renamed in
 * Back Office shows its name: "SQ 7B", or "Pick Up" / "Delivery".
 */
export function tableNameIn(o: Order, saved: SavedLayouts): string {
  if (!o.queueType && o.tableId) {
    for (const items of Object.values(saved)) {
      const t = items.find((x) => x.id === o.tableId);
      if (t) return t.label + (o.checkTag || '');
    }
  }
  return tableName(o);
}

/** Table names that follow Back Office layout edits. */
export function useTableName(): (o: Order) => string {
  const saved = useShared(layoutStore);
  return useCallback((o: Order) => tableNameIn(o, saved), [saved]);
}

/** The section a point on the plan falls in (for tables added in Back Office). */
export function sectionAt(bands: FloorBand[], x: number, y: number): string {
  const b = bands.find((f) => x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h);
  return b?.label ?? bands[0]?.label ?? '';
}

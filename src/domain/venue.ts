/**
 * Venue facts the server screens need that are not part of the dining
 * logic: which venue a table belongs to, whether the kitchen has someone
 * on Expo, and when the check-in button wakes up.
 */
import { catalog, rooms } from '../data';
import type { Order } from './types';
import { getSetting } from '../store/serviceConfig';
import { kitchenHasExpo, venueSettingsStore } from '../store/venueSettings';
import { expoScreenOn } from '../store/phases';
import { layoutStore, savedTable, type SavedLayouts } from '../store/layoutStore';

/**
 * The ids of a venue's tables: the saved floor plan (Back Office) plus the
 * seed tables it doesn't list, so pick up stations and a deleted table that
 * still has a check stay in the venue.
 */
export function venueTableIds(room: string, saved: SavedLayouts = layoutStore.get()): Set<string> | null {
  const seed = rooms[room]?.tables;
  const plan = saved[room];
  if (!seed && !plan) return null;
  const ids = new Set((plan ?? []).filter((t) => t.type === 'seat').map((t) => t.id));
  for (const t of seed ?? []) if (!savedTable(t.id, saved) || t.type !== 'seat') ids.add(t.id);
  return ids;
}

/**
 * __kInVenue: by floor plan, not order.room. Some seeded Evergreen checks
 * say "bistro" although their tables are drawn in Sequoia / Evergreen.
 */
export function inVenue(o: Pick<Order, 'tableId'>, room: string): boolean {
  const ids = venueTableIds(room);
  return !ids || (!!o.tableId && ids.has(o.tableId));
}

/** __kTableRoom: the venue whose floor plan holds the check's table. */
export function tableRoom(o: Pick<Order, 'tableId' | 'room'>): string {
  const saved = o.tableId ? savedTable(o.tableId) : undefined;
  if (saved) return saved.room;
  return Object.keys(rooms).find((k) => rooms[k].tables.some((t) => t.id === o.tableId)) ?? o.room ?? 'sequoia';
}

/** Kitchen screens each venue starts with; Sequoia runs a hot and a cold screen. */
/**
 * __kHasExpo: servers never press Run where Expo runs the courses. A
 * kitchen with one cook screen usually has no one on Expo, so until a venue
 * says otherwise, one screen means the server runs the course.
 */
export function venueHasExpo(room: string): boolean {
  // The Expo screen's release phase is its own: off means no expo anywhere.
  return expoScreenOn() && kitchenHasExpo(venueSettingsStore.get(), room);
}

/**
 * __kCheckInMin: the Check in button stays grey, then turns green this many
 * minutes after a course is run, so servers do not interrupt the first
 * bites. Each venue can set its own; the default is 2.
 */
export function checkInWakeMinutes(room: string): number {
  const perVenue = getSetting<Record<string, number> | undefined>('ciMin')?.[room];
  if (perVenue != null) return Number(perVenue);
  const t = getSetting<number | string | undefined>('t.checkInWake');
  return t != null && t !== '' ? Number(t) : 2;
}

const canonicalByName = new Map<string, string>();
for (const it of catalog) {
  const key = it.name.toLowerCase();
  if (!canonicalByName.has(key)) canonicalByName.set(key, it.id);
}

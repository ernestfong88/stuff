/**
 * Venue facts the server screens need that are not part of the dining
 * logic: which venue a table belongs to, whether the kitchen has someone
 * on Expo, and when the check-in button wakes up.
 */
import { catalog, rooms } from '../../../data';
import type { Order } from '../../../domain/types';
import { getSetting } from '../../../store/serviceConfig';

/**
 * __kInVenue: by floor plan, not order.room. Some seeded Evergreen checks
 * say "bistro" although their tables are drawn in Sequoia / Evergreen.
 */
export function inVenue(o: Pick<Order, 'tableId'>, room: string): boolean {
  const tables = rooms[room]?.tables;
  return !tables || tables.some((t) => t.id === o.tableId);
}

/** __kTableRoom: the venue whose floor plan holds the check's table. */
export function tableRoom(o: Pick<Order, 'tableId' | 'room'>): string {
  return Object.keys(rooms).find((k) => rooms[k].tables.some((t) => t.id === o.tableId)) ?? o.room ?? 'sequoia';
}

/** Kitchen screens each venue starts with; Sequoia runs a hot and a cold screen. */
const DEFAULT_KITCHEN_SCREENS: Record<string, number> = { sequoia: 2 };

/**
 * __kHasExpo: servers never press Run where Expo runs the courses. A
 * kitchen with one cook screen usually has no one on Expo, so until a venue
 * says otherwise, one screen means the server runs the course.
 */
export function venueHasExpo(room: string): boolean {
  const set = getSetting<Record<string, boolean> | undefined>('expo')?.[room];
  if (set != null) return !!set;
  const screens = getSetting<Record<string, unknown[]> | undefined>('kds')?.[room];
  const count = Array.isArray(screens) && screens.length ? screens.length : (DEFAULT_KITCHEN_SCREENS[room] ?? 1);
  return count > 1;
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

/** __kCanon: the recipe behind a menu item; the same dish on several meals shares one. */
export function canonicalItemId(itemId: string): string {
  const it = catalog.find((x) => x.id === itemId);
  return (it && canonicalByName.get(it.name.toLowerCase())) || itemId;
}

/**
 * A venue in plain words, for the Venue Settings overview cards and the
 * venue's header: what kind of place it is, what it serves today, and which
 * kitchen (and tablets) it uses.
 */
import { rooms } from '../../../../data';
import { roomVenue } from '../../../../store/venueMenu';
import { venueMenus, type MenuSummary, type Venue } from '../../../../store/venueSettings';
import { cycleWeekLabel } from '../../../kitchen/admin/menuCycle';

/** "Sequoia / Evergreen kitchen". */
export function kitchenName(room: string): string {
  return `${rooms[room]?.name ?? room} kitchen`;
}

export type VenueKind = 'Dining room' | 'Bistro' | 'Catering';

/** What kind of place a venue is, from its name and kitchen: no kitchen of its own reads as catering. */
export function venueKind(v: Pick<Venue, 'name' | 'room'>): VenueKind {
  if (!v.room || /cater|event|banquet/i.test(v.name)) return 'Catering';
  if (/bistro|caf[eé]|pub|grill|bar\b|lounge|deli|market/i.test(v.name)) return 'Bistro';
  return 'Dining room';
}

/** "This week is week 2 of 4", or null when the cycle has no week 1 date. */
export function thisWeek(v: Pick<Venue, 'menuStartDt'>, cycle: MenuSummary | undefined, at: number): string | null {
  const week = cycle && cycleWeekLabel(v.menuStartDt, cycle, at);
  return week ? `This week is ${week.toLowerCase()}` : null;
}

/**
 * What a venue serves now, one line per menu:
 * ["Cycle: VT Fall 2026 · week 2 of 4", "À la carte: Bistro All-Day"], or an
 * empty list when it has no menu.
 */
export function servingLines(v: Pick<Venue, 'menuId' | 'alcMenuId' | 'menuStartDt'>, menus: MenuSummary[], at: number): string[] {
  const { cycle, alc } = venueMenus(v, menus);
  const out: string[] = [];
  if (cycle) {
    const week = cycleWeekLabel(v.menuStartDt, cycle, at);
    out.push(`Cycle: ${cycle.name} · ${week ? week.toLowerCase() : 'week 1 date not set'}`);
  }
  if (alc) out.push(`À la carte: ${alc.name}`);
  return out;
}

/**
 * Which kitchen a venue uses, in a line: its own, one it shares (and whose
 * tablets it orders from), or none.
 */
export function kitchenLine(v: Venue, venues: Venue[]): string {
  if (!v.room) return 'No kitchen: orders print only';
  const tablets = roomVenue(v.room, venues);
  if (v.active && tablets && tablets.id !== v.id) return `Shares ${tablets.name}'s kitchen & tablets`;
  const sharing = venues.filter((x) => x.active && x.id !== v.id && x.room === v.room);
  return sharing.length ? `${kitchenName(v.room)} & tablets, shared with ${sharing.map((x) => x.name).join(' and ')}` : kitchenName(v.room);
}

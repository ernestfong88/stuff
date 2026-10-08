/**
 * What needs fixing on a venue, worst first: no menu or no start date (the
 * venue serves nothing, or the wrong day), then printers that can't be
 * reached and card terminals that are offline. Each issue names the tab of
 * Venue Settings that fixes it.
 */
import { formatTime } from '../../../../lib/format';
import { venueMenus, venuePrinters, type Venue, type VenueAdminView } from '../../../../store/venueSettings';

export type VenueTab = 'menu' | 'prices' | 'floor' | 'kitchen' | 'devices' | 'details';

export interface VenueIssue {
  venueId: string;
  tab: VenueTab;
  tone: 'danger' | 'warning';
  text: string;
}

export function venueIssues(settings: VenueAdminView, venue: Venue): VenueIssue[] {
  const out: VenueIssue[] = [];
  const add = (tab: VenueTab, tone: VenueIssue['tone'], text: string) => out.push({ venueId: venue.id, tab, tone, text });
  const { cycle, alc } = venueMenus(venue, settings.menus);
  if (!cycle && !alc) add('menu', 'danger', 'No menu, so it serves nothing');
  else if (cycle && !venue.menuStartDt) add('menu', 'danger', `${cycle.name} has no week 1 date, so today's specials can't be picked`);
  // A menu on the tablets that the dietitian hasn't signed off.
  for (const m of [cycle, alc]) {
    if (m?.approval === 'waiting') add('menu', 'warning', `${m.name} is served, but the dietitian hasn't approved it yet`);
    else if (m?.approval === 'none') add('menu', 'warning', `${m.name} is served, but it hasn't been sent to the dietitian for approval`);
  }
  for (const { printer } of venuePrinters(settings, venue.id)) {
    if (!printer.reachable) add('devices', 'warning', `${printer.name} printer can't be reached at ${printer.ip}`);
  }
  for (const t of settings.terminals.filter((x) => x.venueId === venue.id && !x.online)) {
    add('devices', 'warning', `${t.name} is offline${t.lastSeen ? ` since ${formatTime(t.lastSeen)}` : ''}`);
  }
  return out;
}

/** Every active venue's issues, venue by venue. */
export function allVenueIssues(settings: VenueAdminView): VenueIssue[] {
  return settings.venues.filter((v) => v.active).flatMap((v) => venueIssues(settings, v));
}

/** The kitchen a venue cooks in, and the active venue that sets its screens (the first one in it). */
export function kitchenOf(settings: VenueAdminView, venue: Venue): { room: string; owner: Venue } | null {
  if (!venue.room) return null;
  const owner = settings.venues.find((v) => v.active && v.room === venue.room) ?? venue;
  return { room: venue.room, owner };
}

/**
 * What needs fixing on a venue, worst first: no menu or no start date (the
 * venue serves nothing, or the wrong day), then printers that can't be
 * reached and card terminals that are offline. Each issue says where it is
 * fixed: a tab of Venue Settings, or Printers at this venue.
 */
import { formatTime } from '../../../../lib/format';
import { venueMenus, venuePrinters, type Venue, type VenueAdminView } from '../../../../store/venueSettings';
import type { PrintersAt } from '../printers/link';

export type VenueTab = 'menu' | 'prices' | 'floor' | 'kitchen' | 'details';

/** A tab of the venue, or the Printers page (already narrowed to the venue). */
export type IssueFix = { tab: VenueTab } | { printers: Omit<PrintersAt, 'venueId'> };

export interface VenueIssue {
  venueId: string;
  fix: IssueFix;
  tone: 'danger' | 'warning';
  text: string;
}

export function venueIssues(settings: VenueAdminView, venue: Venue): VenueIssue[] {
  const out: VenueIssue[] = [];
  const add = (fix: VenueTab | IssueFix, tone: VenueIssue['tone'], text: string) =>
    out.push({ venueId: venue.id, fix: typeof fix === 'string' ? { tab: fix } : fix, tone, text });
  const { cycle, alc } = venueMenus(venue, settings.menus);
  if (!cycle && !alc) add('menu', 'danger', 'No menu, so it serves nothing');
  else if (cycle && !venue.menuStartDt) add('menu', 'danger', `${cycle.name} has no week 1 date, so today's specials can't be picked`);
  for (const { printer } of venuePrinters(settings, venue.id)) {
    if (!printer.reachable)
      add({ printers: { tab: 'list', printerId: printer.id } }, 'warning', `${printer.name} printer can't be reached at ${printer.ip}`);
  }
  for (const t of settings.terminals.filter((x) => x.venueId === venue.id && !x.online)) {
    add({ printers: { tab: 'terminals' } }, 'warning', `${t.name} is offline${t.lastSeen ? ` since ${formatTime(t.lastSeen)}` : ''}`);
  }
  return out;
}

/** Every active venue's issues, venue by venue. */
export function allVenueIssues(settings: VenueAdminView): VenueIssue[] {
  return settings.venues.filter((v) => v.active).flatMap((v) => venueIssues(settings, v));
}

/** The tab of the venue an issue is fixed on, or null when it is fixed on Printers. */
export const issueTab = (i: VenueIssue): VenueTab | null => ('tab' in i.fix ? i.fix.tab : null);

/** The kitchen a venue cooks in, and the active venue that sets its screens (the first one in it). */
export function kitchenOf(settings: VenueAdminView, venue: Venue): { room: string; owner: Venue } | null {
  if (!venue.room) return null;
  const owner = settings.venues.find((v) => v.active && v.room === venue.room) ?? venue;
  return { room: venue.room, owner };
}

/**
 * "Needs your attention": the few things on the dashboard that someone has
 * to act on, each with where to go to do it.
 */
import { DAY } from '../../../../../lib/clock';
import type { MenuName, VenueMenus } from '../../../seed/venues';

export type AttentionKind = 'eightySix' | 'late' | 'sick' | 'charges' | 'menuSoon' | 'noMenu';

export interface AttentionItem {
  kind: AttentionKind;
  tone: 'info' | 'warn' | 'danger';
  n: number;
  title: string;
  detail: string;
  /** Page to open, with its link text; absent when the fix is made elsewhere. */
  goto?: { page: string; label: string };
  /** Shown instead of a link. */
  note?: string;
}

export interface AttentionInput {
  /** Names of items 86'd today. */
  out: string[];
  lateTickets: number;
  lateMinutes: number;
  /** "Harold Yeung (3 of 3)" for each resident who used every sick waiver. */
  waiversUsedUp: string[];
  chargesToReview: number;
  amountToReview: number;
  venues: VenueMenus[];
  menus: MenuName[];
  at: number;
}

const list = (names: string[], max: number) => names.slice(0, max).join(', ') + (names.length > max ? ' and more' : '');

export function attentionItems(x: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (x.out.length)
    items.push({
      kind: 'eightySix',
      tone: 'danger',
      n: x.out.length,
      title: x.out.length === 1 ? "item 86'd today" : "items 86'd today",
      detail: `${list(x.out, 4)}. Greyed out on every tablet until tomorrow.`,
      note: 'Managers set it on the tablet',
    });
  if (x.lateTickets)
    items.push({
      kind: 'late',
      tone: 'warn',
      n: x.lateTickets,
      title: x.lateTickets === 1 ? 'late ticket today' : 'late tickets today',
      detail: `Fired to up at the pass took longer than ${x.lateMinutes} minutes.`,
      goto: { page: 'svcMetrics', label: 'Shift metrics' },
    });
  if (x.waiversUsedUp.length)
    items.push({
      kind: 'sick',
      tone: 'info',
      n: x.waiversUsedUp.length,
      title: x.waiversUsedUp.length === 1 ? 'resident has used every sick fee waiver' : 'residents have used every sick fee waiver',
      detail: `${x.waiversUsedUp.slice(0, 3).join(', ')}. Their next delivery fee is charged unless a manager comps it.`,
      goto: { page: 'fees', label: 'See the waivers' },
    });
  if (x.chargesToReview)
    items.push({
      kind: 'charges',
      tone: 'warn',
      n: x.chargesToReview,
      title: x.chargesToReview === 1 ? 'charge to review' : 'charges to review',
      detail: `$${x.amountToReview.toFixed(2)} waiting for approval before billing.`,
      goto: { page: 'chargeReview', label: 'Review charges' },
    });
  const soon = x.venues.flatMap((v) =>
    v.upcoming
      .map((u) => ({ v, start: new Date(u.startDt).getTime(), m: x.menus.find((m) => m.id === u.menuId) }))
      .filter((u) => u.m && u.start - x.at < 7 * DAY && u.start >= x.at - DAY),
  );
  if (soon.length)
    items.push({
      kind: 'menuSoon',
      tone: 'info',
      n: soon.length,
      title: soon.length === 1 ? 'menu starts this week' : 'menus start this week',
      detail:
        soon.map((u) => `${u.m!.name} at ${u.v.name.replace(/ Dining Room$/, '')} on ${new Date(u.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`).join(', ') +
        (soon.length === 1 ? '. It goes live on its own that day.' : '. Each goes live on its own start date.'),
      goto: { page: 'menus', label: 'Open menus' },
    });
  const bare = x.venues.filter((v) => v.active && !v.menuId);
  if (bare.length)
    items.push({
      kind: 'noMenu',
      tone: 'danger',
      n: bare.length,
      title: bare.length === 1 ? 'venue has no menu' : 'venues have no menu',
      detail: `${bare.map((v) => v.name).join(', ')} cannot take orders yet.`,
      goto: { page: 'menus', label: 'Schedule a menu' },
    });
  return items;
}

/**
 * "Needs your attention": the few things on the dashboard that someone has
 * to act on, each with where to go to do it.
 */
import { DAY } from '../../../../../lib/clock';

/** A venue and the menus it serves (from Venue Settings). */
export interface VenueMenus {
  id: string;
  name: string;
  active: boolean;
  /** The cycle menu served now, or null. */
  menuId: string | null;
  /** The à la carte menu served, or null. */
  alcMenuId?: string | null;
  /** Menus scheduled to take over, with their start (ms). */
  upcoming: Array<{ menuId: string; startDt: number }>;
}

export interface MenuName {
  id: string;
  name: string;
  status: string;
}

export type AttentionKind = 'eightySix' | 'late' | 'sick' | 'charges' | 'recipes' | 'menuSoon' | 'noMenu';

export interface AttentionItem {
  kind: AttentionKind;
  tone: 'info' | 'warn' | 'danger';
  /** What to do, short and verb-first: the one line the dashboard shows. */
  action: string;
  n: number;
  title: string;
  /** The specifics; the dashboard leaves them to the linked screen. */
  detail: string;
  /**
   * Page to open, with its link text; absent when the fix is made elsewhere.
   * `path` goes deeper into the page, e.g. a venue's Menu tab in Venue Settings.
   */
  goto?: { page: string; label: string; path?: string[] };
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
  /** Recipes the communities sent that wait for Home Office's approval. */
  recipesWaiting?: number;
  /** Signed in as Home Office: only they see (and open) the recipes waiting for approval. */
  homeOffice?: boolean;
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
      action: "Work around today's 86'd items",
      tone: 'danger',
      n: x.out.length,
      title: x.out.length === 1 ? "item 86'd today" : "items 86'd today",
      detail: `${list(x.out, 4)}. Greyed out on every tablet until tomorrow.`,
      note: 'Set on the tablet',
    });
  if (x.lateTickets)
    items.push({
      kind: 'late',
      action: 'Look into late tickets',
      tone: 'warn',
      n: x.lateTickets,
      title: x.lateTickets === 1 ? 'late ticket today' : 'late tickets today',
      detail: `Fired to up at the pass took longer than ${x.lateMinutes} minutes.`,
      // The late mark is a Home Office setting (Alerts & Timing); no shortcut into it.
      note: `Late after ${x.lateMinutes} min, set by Home Office`,
    });
  if (x.waiversUsedUp.length)
    items.push({
      kind: 'sick',
      action: 'Check who is out of sick fee waivers',
      tone: 'info',
      n: x.waiversUsedUp.length,
      title: x.waiversUsedUp.length === 1 ? 'resident has used every sick fee waiver' : 'residents have used every sick fee waiver',
      detail: `${x.waiversUsedUp.slice(0, 3).join(', ')}. Their next delivery fee is charged unless a manager comps it.`,
      goto: { page: 'fees', label: 'See the waivers' },
    });
  if (x.chargesToReview)
    items.push({
      kind: 'charges',
      action: 'Approve charges before billing',
      tone: 'warn',
      n: x.chargesToReview,
      title: x.chargesToReview === 1 ? 'charge to review' : 'charges to review',
      detail: `$${x.amountToReview.toFixed(2)} waiting for approval before billing.`,
      goto: { page: 'chargeReview', label: 'Review charges' },
    });
  // Home Office's queue, so only Home Office sees it (and its link into HO Settings).
  if (x.homeOffice && x.recipesWaiting)
    items.push({
      kind: 'recipes',
      action: `Review ${x.recipesWaiting} ${x.recipesWaiting === 1 ? 'recipe' : 'recipes'} waiting for approval`,
      tone: 'info',
      n: x.recipesWaiting,
      title: x.recipesWaiting === 1 ? 'recipe waiting for approval' : 'recipes waiting for approval',
      detail: 'Sent by the communities to Home Office.',
      goto: { page: 'recipeApproval', label: 'Review recipes' },
    });
  const soon = x.venues.flatMap((v) =>
    v.upcoming
      .map((u) => ({ v, start: new Date(u.startDt).getTime(), m: x.menus.find((m) => m.id === u.menuId) }))
      .filter((u) => u.m && u.start - x.at < 7 * DAY && u.start >= x.at - DAY),
  );
  if (soon.length)
    items.push({
      kind: 'menuSoon',
      action: soon.length === 1 ? 'Check the menu starting this week' : 'Check the menus starting this week',
      tone: 'info',
      n: soon.length,
      title: soon.length === 1 ? 'menu starts this week' : 'menus start this week',
      detail:
        soon
          .map(
            (u) =>
              `${u.m!.name} at ${u.v.name.replace(/ Dining Room$/, '')} on ${new Date(u.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          )
          .join(', ') + (soon.length === 1 ? '. It goes live on its own that day.' : '. Each goes live on its own start date.'),
      // Venue Settings schedules menus; open the venue when there is just one.
      goto: { page: 'venues', label: 'See the schedule', path: soon.length === 1 ? [soon[0].v.id, 'menu'] : undefined },
    });
  const bare = x.venues.filter((v) => v.active && !v.menuId && !v.alcMenuId);
  if (bare.length)
    items.push({
      kind: 'noMenu',
      action: bare.length === 1 ? `Give ${bare[0].name} a menu` : 'Give venues a menu',
      tone: 'danger',
      n: bare.length,
      title: bare.length === 1 ? 'venue has no menu' : 'venues have no menu',
      detail: `${bare.map((v) => v.name).join(', ')} cannot take orders yet.`,
      goto: { page: 'venues', label: bare.length === 1 ? 'Give it a menu' : 'Give them menus', path: [bare[0].id, 'menu'] },
    });
  return items;
}

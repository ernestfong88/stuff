/**
 * Menu Cycle & À la Carte by quarter: each quarter needs a menu cycle and
 * an à la carte menu; past menus go to the Archive.
 */
import type { BoMenu, GridEntry, MenuKind, VenueSchedule } from '../../../../store/menuEdits';
import { menuState, parseQuarter, quarterLabel } from './cycle';

export const ARCHIVE = 'Archive';
export const YEAR_ROUND = 'Year-round';

/** Past quarters and menus archived by hand are in the Archive. */
export function isArchived(m: BoMenu, venues: VenueSchedule[], nowQ: number): boolean {
  const q = parseQuarter(m.quarter);
  return menuState(m, venues) === 'archived' || (q != null && q.index < nowQ);
}

/** The quarter filter: this quarter and the next three, any quarter a menu is in, newest first. */
export function quarterFilterOptions(menus: BoMenu[], nowQ: number): string[] {
  const set = new Set([0, 1, 2, 3].map((k) => quarterLabel(nowQ + k)));
  for (const m of menus) if (parseQuarter(m.quarter)) set.add(m.quarter);
  return [...set].sort((a, b) => parseQuarter(b)!.index - parseQuarter(a)!.index);
}

/** A cycle with Any Day items also counts as the quarter's à la carte menu. */
export function hasEveryDay(grid: GridEntry[], menuId: string): boolean {
  return grid.some((g) => g.menuId === menuId && g.day === 0);
}

export interface MenuRow {
  menu: BoMenu;
  /** The row is a cycle's every-day items shown with the à la carte menus. */
  everyDay: boolean;
}

export function menuRows(menus: BoMenu[], grid: GridEntry[], venues: VenueSchedule[], tab: MenuKind, quarter: string, search: string, nowQ: number): MenuRow[] {
  const inQ = (m: BoMenu) =>
    quarter === ARCHIVE
      ? isArchived(m, venues, nowQ)
      : quarter === YEAR_ROUND
        ? m.quarter === YEAR_ROUND && !isArchived(m, venues, nowQ)
        : m.quarter === quarter && !isArchived(m, venues, nowQ);
  const rows: MenuRow[] = [
    ...menus.filter((m) => m.kind === tab && inQ(m)).map((menu) => ({ menu, everyDay: false })),
    ...(tab === 'alc' ? menus.filter((m) => m.kind === 'cycle' && inQ(m) && hasEveryDay(grid, m.id)).map((menu) => ({ menu, everyDay: true })) : []),
  ];
  const q = search.trim().toLowerCase();
  const name = (r: MenuRow) => (r.everyDay ? r.menu.name + ' · Every-day items' : r.menu.name);
  return rows
    .filter((r) => !q || name(r).toLowerCase().includes(q))
    .sort((a, b) => Number(!!b.menu.fav) - Number(!!a.menu.fav) || name(a).localeCompare(name(b)));
}

/** Kinds of menu a future quarter still lacks. */
export function quarterGaps(menus: BoMenu[], grid: GridEntry[], venues: VenueSchedule[], tab: MenuKind, quarter: string, nowQ: number): MenuKind[] {
  const p = parseQuarter(quarter);
  if (!p || p.index < nowQ) return [];
  const has = menus.some(
    (m) => m.quarter === quarter && !isArchived(m, venues, nowQ) && (m.kind === tab || (tab === 'alc' && m.kind === 'cycle' && hasEveryDay(grid, m.id))),
  );
  return has ? [] : [tab];
}

/**
 * Associate meal settings, kept with the other service settings so Back
 * Office edits reach every phone at once:
 *   am.days, am.std, am.weeks   the menu (see src/store/assocMenu.ts)
 *   am.venue    the venue that serves associate meals (one per community)
 *   am.cut      ordering closes this many minutes before a range starts
 *   win.grid    pick up ranges per venue (Back Office: Pick Up Windows)
 *   win.cap     orders per range per venue
 *   win.nocBy   when the dinner line closes and sets NOC meals out
 */
import { rooms } from '../../data';
import { useSetting } from '../../store/serviceConfig';
import type { MenuWeek } from './menu';
import type { WindowCap, WindowGrid } from './windows';

export interface AssocSettings {
  weeks: Record<string, Partial<MenuWeek>>;
  venue: string;
  cutoffMin: number;
  nocBy: number;
  grid: WindowGrid | undefined;
  caps: Record<string, WindowCap | null> | undefined;
}

export const DEFAULT_ASSOC_VENUE = 'sequoia';
export const DEFAULT_CUTOFF_MIN = 45;
/** 8 PM. */
export const DEFAULT_NOC_BY = 1200;

const numberOr = (v: unknown, fallback: number) => (v == null || v === '' || Number.isNaN(Number(v)) ? fallback : Number(v));

export function useAssocSettings(): AssocSettings {
  const weeks = useSetting<Record<string, Partial<MenuWeek>> | undefined>('am.weeks');
  const venueSetting = useSetting<string | undefined>('am.venue');
  const cut = useSetting<unknown>('am.cut');
  const nocBy = useSetting<unknown>('win.nocBy');
  const grids = useSetting<Record<string, WindowGrid> | undefined>('win.grid');
  const caps = useSetting<Record<string, WindowCap | null> | undefined>('win.cap');
  const venue = venueSetting && rooms[venueSetting] ? venueSetting : DEFAULT_ASSOC_VENUE;
  return {
    weeks: weeks ?? {},
    venue,
    cutoffMin: numberOr(cut, DEFAULT_CUTOFF_MIN),
    nocBy: numberOr(nocBy, DEFAULT_NOC_BY),
    grid: grids?.[venue],
    caps,
  };
}

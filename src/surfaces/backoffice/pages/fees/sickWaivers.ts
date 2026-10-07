/**
 * Who has used sick delivery-fee waivers this period, for the Delivery
 * Options page and the dashboard's "used every waiver" card.
 */
import type { Order } from '../../../../domain/types';
import type { SickWaiverRecord } from '../../../../domain/waivers';

export interface WaiverUse {
  rid: string;
  used: number;
  left: number;
  /** Used them all (or more, granted past the limit with a manager PIN). */
  allUsed: boolean;
}

/** Waivers per resident, most used first, then by name. */
export function waiverUseByResident(waivers: Array<SickWaiverRecord | Order>, allow: number, nameOf: (rid: string) => string | undefined): WaiverUse[] {
  const by = new Map<string, number>();
  for (const w of waivers) {
    const rid = w.sickTray?.rid;
    if (rid) by.set(rid, (by.get(rid) ?? 0) + 1);
  }
  return [...by.entries()]
    .filter(([rid]) => nameOf(rid))
    .map(([rid, used]) => ({ rid, used, left: allow - used, allUsed: used >= allow }))
    .sort((a, b) => b.used - a.used || (nameOf(a.rid) ?? '').localeCompare(nameOf(b.rid) ?? ''));
}

/** "3 of 3 used", or "4 used, limit 3" when a manager granted extra. */
export function waiverUseText(u: Pick<WaiverUse, 'used'>, allow: number): string {
  return u.used > allow ? `${u.used} used, limit ${allow}` : `${u.used} of ${allow} used`;
}

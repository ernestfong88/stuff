/**
 * Back office resident records: the billing side of a resident (meal plan,
 * plan start day, kitchen notes). They come from `boResidents` in src/data.
 */
import { boResidents, getResident } from '../../../data';
import type { Resident } from '../../../domain/types';

export interface BoResident {
  id: string;
  name: string;
  apt: string;
  level: string;
  planId: string;
  /** Billing cycle anchor, 1 to 28. */
  startDay: number;
  coupleStartDay: number | null;
  spouseId: string | null;
  prefs: string;
  kitchenNotes: string;
  diet: string[];
  allergies: string[];
  /** Plan changes drive billing, so each one is kept: newest first. */
  planLog?: Array<{ at: number; by: string; from: string; to: string }>;
}

export const seedBoResidents = (): BoResident[] => boResidents.map((r) => ({ ...(r as unknown as BoResident) }));

/**
 * The dining app's record for the same person. Ids are shared, but only
 * trust the match when the names agree too: a few back office records carry
 * ids the tablets use for someone else.
 */
export function diningResident(r: Pick<BoResident, 'id' | 'name'>): Resident | undefined {
  const d = getResident(r.id);
  return d && d.name === r.name ? d : undefined;
}

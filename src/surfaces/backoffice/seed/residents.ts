/**
 * Back office resident records: the billing side of a resident (meal plan,
 * plan start day, kitchen notes). They come from `boResidents` in src/data.
 */
import { boResidents, getResident, residents } from '../../../data';
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

/** The billing plan for a resident the back office has no record of yet, from the tablets' plan. */
const PLAN_FOR: Record<string, string> = { monthly30: 'pl1', daily2: 'pl8', alacarte: 'pl4' };

/** A back office record for a resident who only has a dining record so far. */
function fromDining(d: Resident): BoResident {
  return {
    id: d.id,
    name: d.name,
    apt: d.apt,
    level: d.level,
    planId: PLAN_FOR[d.plan] ?? 'pl1',
    startDay: 1,
    coupleStartDay: d.spouse ? 1 : null,
    spouseId: d.spouse ?? null,
    prefs: d.fav ?? '',
    kitchenNotes: '',
    diet: [...d.diet],
    allergies: [...d.allergies],
  };
}

/**
 * Every resident the dining tablets know, with the back office's billing
 * side where it has one. The care level, diet and allergies always come from
 * the dining record (the care assessment), so Billing and Residents agree.
 * Records the dining app doesn't know (or that carry someone else's id) are
 * kept as they are.
 */
export function withAllResidents(list: BoResident[]): BoResident[] {
  const out: BoResident[] = [];
  const used = new Set<string>();
  for (const d of residents) {
    const bo = list.find((r) => r.id === d.id && r.name === d.name);
    if (bo) used.add(bo.id);
    out.push(bo ? { ...bo, level: d.level, diet: [...d.diet], allergies: [...d.allergies] } : fromDining(d));
  }
  for (const r of list) if (!used.has(r.id) && !out.some((x) => x.id === r.id)) out.push(r);
  const same = out.length === list.length && out.every((r, i) => r === list[i] || JSON.stringify(r) === JSON.stringify(list[i]));
  return same ? list : out;
}

export const seedBoResidents = (): BoResident[] => withAllResidents(boResidents.map((r) => ({ ...(r as unknown as BoResident) })));

/** A resident's care level (IL or AL), from the dining record: the one source every page reads. */
export function careLevel(id: string): string | undefined {
  return getResident(id)?.level;
}

/**
 * The dining app's record for the same person. Ids are shared, but only
 * trust the match when the names agree too: a few back office records carry
 * ids the tablets use for someone else.
 */
export function diningResident(r: Pick<BoResident, 'id' | 'name'>): Resident | undefined {
  const d = getResident(r.id);
  return d && d.name === r.name ? d : undefined;
}

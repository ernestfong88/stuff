import { mealPlans } from '../../../../data';
import type { MealPlan, Resident } from '../../../../domain/types';
import { residentPlan } from '../../../backoffice/kit/residentRecords';

export const CARE_LEVELS: Record<string, string> = {
  IL: 'Independent Living',
  AL: 'Assisted Living',
  MC: 'Memory Care',
  SN: 'Skilled Nursing',
};

export function careLevel(level: string): string {
  return CARE_LEVELS[level] ?? level;
}

/**
 * Search by name or apartment, best matches first: the exact apartment,
 * then apartments starting with it, then a name word starting with it,
 * then the name containing it anywhere.
 */
export function searchResidents<T extends Pick<Resident, 'name' | 'apt'>>(list: T[], query: string, limit = Infinity): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, limit);
  const score = (r: T) => {
    const name = r.name.toLowerCase();
    const apt = String(r.apt ?? '').toLowerCase();
    if (apt === q) return 0;
    if (apt.startsWith(q)) return 1;
    if (name.split(' ').some((w) => w.startsWith(q))) return 2;
    if (name.includes(q)) return 3;
    return 99;
  };
  return list
    .map((r) => ({ r, s: score(r) }))
    .filter((x) => x.s < 99)
    .sort((a, b) => a.s - b.s || a.r.name.localeCompare(b.r.name))
    .slice(0, limit)
    .map((x) => x.r);
}

export interface PlanStatus {
  plan: MealPlan;
  /** Meals left this period, or null for à la carte. */
  left: number | null;
  /** "this month" or "today". */
  period: string;
}

export function planStatus(r: Pick<Resident, 'plan' | 'consumed'> & { id?: string }): PlanStatus {
  // The Back Office plan when the resident is known there, else the seed's.
  const plan = r.id ? residentPlan(r.id) : (mealPlans[r.plan] ?? mealPlans.alacarte);
  const left = plan.amt ? Math.max(0, plan.amt - r.consumed) : null;
  return { plan, left, period: plan.type === 'Daily' ? 'today' : 'this month' };
}

/**
 * "12 meals till 11/1". Plans carry no reset date, only a per month or per
 * day allowance, so a monthly plan resets on the 1st and a daily plan
 * tomorrow.
 */
export function planTill(r: Pick<Resident, 'plan' | 'consumed'> & { id?: string }, at: Date): string | null {
  const { plan, left } = planStatus(r);
  if (left == null) return null;
  const d = new Date(at);
  if (plan.type === 'Daily') d.setDate(d.getDate() + 1);
  else d.setMonth(d.getMonth() + 1, 1);
  return `${left} ${left === 1 ? 'meal' : 'meals'} till ${d.getMonth() + 1}/${d.getDate()}`;
}

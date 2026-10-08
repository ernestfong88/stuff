/**
 * The default meal plan for each care level: what a resident starts on when
 * the back office has no plan for them yet and the tablets' plan doesn't
 * match one (a new resident). Replaces the single "default" tick on Meal
 * Plans; saved copies that only have the tick are carried over.
 * Pure: no React, store or data imports.
 */
import type { BoMealPlan } from '../seed/billing';

/** Care level → plan id. A blank id means "no default" was chosen. */
export type DefaultPlans = Record<string, string>;

/** Care levels in the order a community thinks of them; others follow by name. */
const LEVEL_ORDER = ['IL', 'AL', 'MC', 'SNF'];

export const CARE_LEVEL_NAMES: Record<string, string> = {
  IL: 'Independent Living',
  AL: 'Assisted Living',
  MC: 'Memory Care',
  SNF: 'Skilled Nursing',
};

/** The distinct care levels among these, in the usual order. */
export function careLevelsOf(levels: Iterable<string | null | undefined>): string[] {
  const rank = (l: string) => (LEVEL_ORDER.includes(l) ? LEVEL_ORDER.indexOf(l) : LEVEL_ORDER.length);
  return [...new Set([...levels].filter((l): l is string => !!l))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** The plan a resident at this care level starts on: undefined when none is set or it was retired. */
export function defaultPlanFor(
  level: string | null | undefined,
  defaults: DefaultPlans | undefined,
  plans: readonly BoMealPlan[],
): BoMealPlan | undefined {
  const id = level ? defaults?.[level] : undefined;
  return id ? plans.find((p) => p.id === id && p.active) : undefined;
}

/** Whether a plan's name is for this care level ("IL Spenddown" is for IL). */
const namedFor = (p: BoMealPlan, level: string) => new RegExp(`(^|[^A-Za-z])${level}([^A-Za-z]|$)`).test(p.text);

/**
 * Care-level defaults for a saved copy. One that already has them keeps
 * them, and only gains a level it has never seen from the shipped ones. One
 * from before (just the single "default" tick, sometimes on two plans) takes
 * the ticked plan named for each level, else the shipped default; a level
 * with neither is left unset rather than guessed.
 */
export function migrateDefaultPlans(saved: DefaultPlans | undefined, plans: readonly BoMealPlan[], shipped: DefaultPlans): DefaultPlans {
  const live = (id: string | undefined) => (id && plans.some((p) => p.id === id && p.active) ? id : undefined);
  if (saved) {
    const out = { ...saved };
    for (const [level, id] of Object.entries(shipped)) if (!(level in out) && live(id)) out[level] = id;
    return out;
  }
  const out: DefaultPlans = {};
  for (const level of careLevelsOf([...Object.keys(shipped), ...plans.flatMap((p) => LEVEL_ORDER.filter((l) => namedFor(p, l)))])) {
    const ticked = plans.find((p) => p.active && p.isDefault && namedFor(p, level));
    const id = ticked?.id ?? live(shipped[level]);
    if (id) out[level] = id;
  }
  return out;
}

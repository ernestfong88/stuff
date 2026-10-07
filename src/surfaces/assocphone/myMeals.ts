/**
 * What the associate can still do with a planned meal, and how the phone
 * words a meal's status. Pure, so the rules can be tested.
 */
import type { AssocMeal } from '../../domain/types';
import type { NewMeal } from '../../domain/assocMeals/meals';
import { windowClosesAt } from '../../domain/assocMeals/windows';

/**
 * A planned meal can be changed or cancelled until ordering for its range
 * closes. After that the kitchen is making it.
 */
export function canChangeMeal(meal: Pick<AssocMeal, 'date' | 'window'>, cutoffMin: number, nocBy: number, nowMs: number): boolean {
  return nowMs < windowClosesAt(meal.date, meal.window, cutoffMin, nocBy);
}

/** Swap a planned meal for a new choice, keeping its id and adding a line to its log. */
export function changeMeal(all: AssocMeal[], id: string, next: NewMeal, by: string, at: number): AssocMeal[] {
  return all.map((m) =>
    m.id === id
      ? {
          ...m,
          meal: next.meal,
          item: next.item,
          recipeIds: next.recipeIds,
          window: next.window,
          note: next.note,
          mods: { ...next.mods },
          log: [...(m.log || []), { by, at, text: `Changed to ${next.item} in the Associate App` }],
        }
      : m,
  );
}

/** The choices saved on a meal, as the plan screen holds them. */
export function pickedMods(meal: Pick<AssocMeal, 'mods'> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(meal?.mods ?? {})) if (typeof v === 'string') out[k] = v;
  return out;
}

/** "Cancelled — shift removed" reads "Cancelled: shift removed" on the phone. */
export function statusText(status: string): string {
  return status.replace(/\s+[—–]\s+/g, ': ');
}

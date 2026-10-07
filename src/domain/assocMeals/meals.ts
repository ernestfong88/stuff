/** Reading and changing the associate's own meals in the dining store. */
import type { AssocMeal } from '../types';

/** One line of a meal's history. A change made for the associate is texted to them. */
export interface AssocLogEntry {
  by: string;
  at: number;
  text: string;
  texted?: boolean;
}

function isLogEntry(x: unknown): x is AssocLogEntry {
  return !!x && typeof x === 'object' && typeof (x as AssocLogEntry).text === 'string';
}

/** The latest text the associate was sent about this meal, if any. */
export function lastTexted(meal: AssocMeal): string | null {
  const texted = meal.log.filter(isLogEntry).filter((e) => e.texted);
  return texted.length ? texted[texted.length - 1].text : null;
}

export function mealsOf(all: AssocMeal[], associate: string): AssocMeal[] {
  return all.filter((m) => m.associate === associate);
}

/** The meal planned for a day, if one is. */
export function plannedOn(mine: AssocMeal[], date: string): AssocMeal | undefined {
  return mine.find((m) => m.date === date && m.status === 'Planned');
}

/** Meals no longer planned (picked up or cancelled), newest day first. */
export function pastMeals(mine: AssocMeal[]): AssocMeal[] {
  return mine.filter((m) => m.status !== 'Planned').sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function cancelMeal(all: AssocMeal[], id: string, by: string, at: number): AssocMeal[] {
  return all.map((m) => (m.id === id ? { ...m, status: 'Cancelled', log: [...m.log, { by, at, text: 'Cancelled in the Associate App' }] } : m));
}

export interface NewMeal {
  date: string;
  meal: string;
  item: string;
  window: string;
  mods: Record<string, string>;
  note: string;
}

export function planMeal(all: AssocMeal[], meal: NewMeal, associate: string, at: number): AssocMeal[] {
  const added: AssocMeal = {
    id: 'n' + at.toString(36),
    date: meal.date,
    meal: meal.meal,
    item: meal.item,
    window: meal.window,
    associate,
    status: 'Planned',
    note: meal.note,
    mods: { ...meal.mods },
    log: [{ by: associate, at, text: 'Planned in the Associate App' }],
  };
  return [added, ...all];
}

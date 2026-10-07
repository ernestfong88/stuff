/**
 * The review screen reads the order back one answer to a line, and each
 * line opens its question to change it, then comes back to the review.
 */
import { getItem } from '../../../data';
import { defaultSides } from '../../../domain/menu';
import { dishLongName, drinkName, listWords, type KioskMenu } from '../../../domain/kioskMenu';
import type { KioskState, Screen } from './flow';
import { mainDishName, reviewWhen } from './order';

export interface ReviewLine {
  key: string;
  /** "Main dish" */
  label: string;
  /** "Peach Glazed Chicken Breast, with mashed potatoes and garlic green beans" */
  value: string;
  /** The question that changes it. */
  to: Screen;
  patch: Partial<KioskState>;
}

const nameOf = (id: string | null) => (id ? dishLongName(getItem(id)?.name ?? '') : '');

/** "Peach Glazed Chicken Breast, with mashed potatoes and garlic green beans", "Veggie Pizza, no side". */
export function mainWithSides(s: Pick<KioskState, 'entree' | 'version' | 'side'>): string {
  if (!s.entree) return '';
  const name = mainDishName(s);
  if (s.side === 'none') return `${name}, no side`;
  const sides = !s.side || s.side === 'keep' ? defaultSides(s.entree).map((id) => nameOf(id)).filter(Boolean) : [nameOf(s.side)];
  return sides.length ? `${name}, with ${listWords(sides)}` : name;
}

/** The answers on the review, in the order they were asked. Soup and dessert show only when the meal has them. */
export function reviewLines(s: KioskState, menu: KioskMenu | null, today: string): ReviewLine[] {
  const drink = getItem(s.drink);
  return [
    { key: 'when', label: 'When', value: reviewWhen(s, today).replace(/\.$/, ''), to: 'type', patch: {} },
    { key: 'main', label: 'Main dish', value: mainWithSides(s) || 'No main dish', to: 'entree', patch: { special: 0, others: false } },
    ...(menu?.soups.length ? [{ key: 'soup', label: 'Soup', value: nameOf(s.soup) || 'No soup', to: 'soup' as const, patch: {} }] : []),
    { key: 'drink', label: 'Drink', value: drink ? drinkName(drink) : 'No drink', to: 'drink', patch: {} },
    ...(menu?.desserts.length
      ? [{ key: 'dessert', label: 'Dessert', value: nameOf(s.dessert) || 'No dessert', to: 'dessert' as const, patch: { moreDessert: false } }]
      : []),
    { key: 'notes', label: 'Changes', value: s.note || 'No changes', to: 'notes', patch: {} },
    { key: 'utensils', label: 'Utensils', value: s.utensils ? 'Utensils and a napkin' : 'No utensils or napkin', to: 'utensils', patch: {} },
  ];
}

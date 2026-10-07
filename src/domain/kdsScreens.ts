/**
 * KDS screens: each kitchen runs one to three cook screens, named by the
 * kitchen, and each shows the subcategories ticked for it.
 *
 * - A subcategory ticked nowhere goes to the first screen, so nothing is lost.
 * - One ticked on two screens shows on both, and whichever screen bumps it
 *   first marks it done on both.
 * - What the server makes never reaches a cook screen (Kitchen Routing).
 *
 * A screen is addressed by a key "room:index", e.g. "sequoia:1".
 */
import { allKdsKeys, kdsKeyOf, SUBCATEGORIES, type SubcategoryChoices } from './subcategories';

export interface KdsScreen {
  name: string;
  /** Ticked "Group|Subcategory" keys. */
  subs: string[];
}

export const MAX_SCREENS = 3;

export const screenKey = (room: string, index: number) => room + ':' + index;

/** One screen that shows everything the cook makes. */
export function singleScreen(name = 'Kitchen'): KdsScreen[] {
  return [{ name, subs: allKdsKeys() }];
}

/** The screens a dish shows on in a kitchen. */
export function screensForItem(itemId: string, room: string, screens: readonly KdsScreen[], choices: SubcategoryChoices): string[] {
  if (screens.length < 2) return [screenKey(room, 0)];
  const key = kdsKeyOf(itemId, choices);
  const hits = screens.flatMap((s, i) => (s.subs.includes(key) ? [screenKey(room, i)] : []));
  return hits.length ? hits : [screenKey(room, 0)];
}

/** Subcategories ticked on no screen (they go to the first one). */
export function looseSubcategories(screens: readonly KdsScreen[]): string[] {
  if (screens.length < 2) return [];
  return allKdsKeys().filter((k) => !screens.some((s) => s.subs.includes(k)));
}

/** Tick or untick a subcategory on one screen. */
export function toggleSubcategory(screens: readonly KdsScreen[], index: number, key: string): KdsScreen[] {
  return screens.map((s, i) =>
    i !== index ? s : { ...s, subs: s.subs.includes(key) ? s.subs.filter((k) => k !== key) : [...s.subs, key] },
  );
}

export function renameScreen(screens: readonly KdsScreen[], index: number, name: string): KdsScreen[] {
  return screens.map((s, i) => (i === index ? { ...s, name } : s));
}

const DESSERT_KEYS = SUBCATEGORIES.Desserts.map((s) => 'Desserts|' + s);

/**
 * Change how many screens a kitchen has. Removing screens moves what only
 * they showed onto the last screen kept. A second screen starts empty
 * (named Cold); a third takes the desserts off the others.
 */
export function resizeScreens(screens: readonly KdsScreen[], count: number): KdsScreen[] {
  const n = Math.max(1, Math.min(MAX_SCREENS, count));
  let next = screens.slice(0, n).map((s) => ({ ...s, subs: [...s.subs] }));
  if (n < screens.length) {
    const kept = new Set(next.flatMap((s) => s.subs));
    const last = next[n - 1];
    for (const s of screens.slice(n))
      for (const k of s.subs)
        if (!kept.has(k) && !last.subs.includes(k)) last.subs.push(k);
  }
  while (next.length < n) {
    const i = next.length;
    if (i === 0) next.push({ name: 'Hot', subs: allKdsKeys() });
    else if (i === 1) next.push({ name: 'Cold', subs: [] });
    else {
      next = next.map((s) => ({ ...s, subs: s.subs.filter((k) => !DESSERT_KEYS.includes(k)) }));
      next.push({ name: 'Dessert', subs: [...DESSERT_KEYS] });
    }
  }
  return next;
}

/**
 * Copy modifiers from another community. Groups with a name this community
 * already uses gain the choices it lacks; the rest come in as new groups.
 * Nothing is removed or renamed, and up-charges on existing choices stay.
 */
import type { BoModGroup, BoModOption } from '../../../../store/menuEdits';

export interface SharedModGroup {
  name: string;
  mods: BoModOption[];
}

/** What other Kisco communities share. Stand-in until the Home Office API serves it. */
export const OTHER_COMMUNITY_MODS: Record<string, SharedModGroup[]> = {
  'Cypress Court': [
    { name: 'Dressing', mods: [{ n: 'Ranch' }, { n: 'Lemon Herb Vinaigrette' }, { n: 'Greek' }] },
    { name: 'Meat Temp', mods: [{ n: 'Rare' }, { n: 'Medium Rare' }, { n: 'Medium' }, { n: 'Medium Well' }, { n: 'Well Done' }] },
    { name: 'Soup Size', mods: [{ n: 'Cup' }, { n: 'Bowl', price: 2 }] },
    { name: 'Toast', mods: [{ n: 'White' }, { n: 'Wheat' }, { n: 'Rye' }, { n: 'Sourdough' }, { n: 'English Muffin' }] },
  ],
  'Cardinal at North Hills': [
    { name: 'BBQ Sauce', mods: [{ n: 'Carolina Vinegar' }, { n: 'Sweet Tennessee' }, { n: 'Mustard' }] },
    { name: 'Grits', mods: [{ n: 'Plain' }, { n: 'Cheese' }, { n: 'Shrimp', price: 3 }] },
    { name: 'Sides', mods: [{ n: 'Collard Greens' }, { n: 'Hush Puppies' }, { n: 'French Fries' }] },
  ],
  'La Posada': [
    { name: 'Salsa', mods: [{ n: 'Pico de Gallo' }, { n: 'Salsa Verde' }, { n: 'Salsa Roja' }] },
    { name: 'Tortilla', mods: [{ n: 'Corn' }, { n: 'Flour' }] },
    { name: 'Chile', mods: [{ n: 'Red' }, { n: 'Green' }, { n: 'Christmas (both)' }] },
  ],
};

export interface CopyPlan {
  /** Groups after the copy. */
  groups: BoModGroup[];
  /** Names of the new groups. */
  added: string[];
  /** Existing groups that gain choices, with the choices they gain. */
  extended: Array<{ name: string; choices: string[] }>;
}

const key = (s: string) => s.trim().toLowerCase();

/** Merge another community's groups into ours. `newId` makes ids for new groups. */
export function planCopy(current: BoModGroup[], incoming: SharedModGroup[], newId: (i: number) => string): CopyPlan {
  const added: string[] = [];
  const extended: CopyPlan['extended'] = [];
  let groups = current.slice();
  incoming.forEach((src, i) => {
    const match = groups.find((g) => g.active && key(g.name) === key(src.name));
    if (!match) {
      groups = [...groups, { id: newId(i), name: src.name, active: true, usage90: 0, pinned: [], mods: src.mods.map((m) => ({ ...m })) }];
      added.push(src.name);
      return;
    }
    const have = new Set(match.mods.map((m) => key(m.n)));
    const extra = src.mods.filter((m) => !have.has(key(m.n)));
    if (!extra.length) return;
    groups = groups.map((g) => (g.id === match.id ? { ...g, mods: [...g.mods, ...extra.map((m) => ({ ...m }))] } : g));
    extended.push({ name: match.name, choices: extra.map((m) => m.n) });
  });
  return { groups, added, extended };
}

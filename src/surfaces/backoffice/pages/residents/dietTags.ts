/**
 * Every resident's allergy and diet tags exactly as the kitchen ticket
 * prints them, grouped as allergy, diet or texture.
 */
import { residentPills } from '../../../../domain/residents';
import type { Resident } from '../../../../domain/types';

export type TagCategory = 'allergy' | 'diet' | 'texture';

/** Order of the categories wherever they are listed. */
export const CATEGORY_ORDER: Record<TagCategory, number> = { allergy: 0, diet: 1, texture: 2 };

/** Textures and thickened liquids are diets on the ticket, but the kitchen plans them apart. */
const TEXTURE = /puree|mech|chop|mince|nectar|honey|thick|soft|ground/i;

export interface Tag {
  cat: TagCategory;
  text: string;
}

export const tagKey = (t: Tag) => `${t.cat}|${t.text}`;

export interface DietRow {
  r: Resident;
  tags: Tag[];
  /** The care assessment's own wording. */
  onFile: string[];
}

export function dietRows(residents: Resident[]): DietRow[] {
  return residents.map((r) => ({
    r,
    tags: residentPills(r).map((p) => ({ text: p.text, cat: p.kind === 'allergy' ? 'allergy' : TEXTURE.test(p.text) ? 'texture' : 'diet' })),
    onFile: [...(r.allergies ?? []), ...(r.diet ?? []), ...(r.foodPrep ? [`Food prep: ${r.foodPrep}`] : [])],
  }));
}

export interface TagCount extends Tag {
  key: string;
  n: number;
}

/** How many residents carry each tag, allergies first, then most common. */
export function tagCounts(rows: DietRow[]): TagCount[] {
  const tally = new Map<string, TagCount>();
  for (const row of rows)
    for (const t of row.tags) {
      const k = tagKey(t);
      const cur = tally.get(k) ?? { ...t, key: k, n: 0 };
      tally.set(k, { ...cur, n: cur.n + 1 });
    }
  return [...tally.values()].sort((a, b) => CATEGORY_ORDER[a.cat] - CATEGORY_ORDER[b.cat] || b.n - a.n || a.text.localeCompare(b.text));
}

/** Ticket shorthand in plain words, for filters ("GF" is "Gluten-free"). */
const PLAIN: Record<string, string> = {
  NAS: 'No salt added',
  'Low Na': 'Low sodium',
  Diab: 'Diabetic',
  GF: 'Gluten-free',
  Puree: 'Pureed',
  'Nectar thick': 'Nectar-thick liquids',
};

export const tagLabel = (text: string): string => PLAIN[text] ?? text;

/**
 * Allergies & Diets report: every resident's tags exactly as the kitchen
 * ticket prints them, grouped as allergy, diet or texture.
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

export type DietSortKey = 'name' | 'apt' | 'level' | 'tags';

const sortValue: Record<DietSortKey, (x: DietRow) => string> = {
  name: (x) => x.r.name.toLowerCase(),
  apt: (x) => String(x.r.apt ?? '').padStart(6, '0'),
  level: (x) => (x.r.level ?? '') + x.r.name.toLowerCase(),
  tags: (x) => (x.tags.length ? CATEGORY_ORDER[x.tags[0].cat] + x.tags.map((t) => t.text.toLowerCase()).join(',') : '9'),
};

export interface DietFilter {
  query: string;
  cat: TagCategory | 'all';
  tag: string | null;
  includeNone: boolean;
  sort: { key: DietSortKey; dir: 1 | -1 };
}

export function filterDietRows(rows: DietRow[], f: DietFilter): DietRow[] {
  const q = f.query.trim().toLowerCase();
  return rows
    .filter(
      (x) =>
        (f.includeNone || x.tags.length > 0) &&
        (f.cat === 'all' || x.tags.some((t) => t.cat === f.cat)) &&
        (!f.tag || x.tags.some((t) => tagKey(t) === f.tag)) &&
        (!q || [x.r.name, x.r.apt, ...x.tags.map((t) => t.text), ...x.onFile].join(' ').toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      const A = sortValue[f.sort.key](a);
      const B = sortValue[f.sort.key](b);
      return (A < B ? -1 : A > B ? 1 : 0) * f.sort.dir || a.r.name.localeCompare(b.r.name);
    });
}

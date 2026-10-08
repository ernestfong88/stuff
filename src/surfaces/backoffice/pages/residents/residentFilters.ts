/**
 * Filters over the Resident Dining Profile list: care level, diets and
 * allergies (any of the chosen), meal plan, and a search box. Each filter's
 * counts are worked out with the other filters applied, so "Gluten-free 2"
 * under AL means two AL residents.
 */
import { allergenKeysIn, personAvoids, type AllergenKey, type AvoidSource } from '../../../../domain/allergens';
import type { Resident } from '../../../../domain/types';
import { searchResidents } from '../../../server/features/residents/residentInfo';
import type { BoMealPlan } from '../../seed/billing';
import { CATEGORY_ORDER, dietRows, tagCounts, tagLabel, type DietRow, type TagCategory, type TagCount } from './dietTags';

/** The plan a resident is filtered under. */
export interface PlanBucket {
  id: string;
  label: string;
}

export const A_LA_CARTE: PlanBucket = { id: 'alacarte', label: 'À la carte' };

/** Their Back Office plan; a $0 plan, or none at all, pays item by item, so it is à la carte. */
export function planBucket(planId: string | null | undefined, plans: readonly Pick<BoMealPlan, 'id' | 'text' | 'amt'>[]): PlanBucket {
  const p = plans.find((x) => x.id === planId);
  return !p || p.amt <= 0 ? A_LA_CARTE : { id: p.id, label: p.text };
}

export interface ProfileRow extends DietRow {
  plan: PlanBucket;
}

export function profileRows(list: Resident[], planOf: (r: Resident) => PlanBucket): ProfileRow[] {
  return dietRows(list).map((x) => ({ ...x, plan: planOf(x.r) }));
}

/**
 * What to show. `tags` are tag keys ("allergy|Gluten"), whole categories
 * ("any|allergy") or "none" (nothing on file); a resident matches any of them.
 */
export interface ProfileFilter {
  query: string;
  level: string;
  tags: string[];
  plan: string;
}

export const ALL = 'all';
export const NO_FILTER: ProfileFilter = { query: '', level: ALL, tags: [], plan: ALL };
export const NOTHING_ON_FILE = 'none';
export const anyOf = (cat: TagCategory) => `any|${cat}`;

export const isFiltered = (f: ProfileFilter) => f.query.trim() !== '' || f.level !== ALL || f.tags.length > 0 || f.plan !== ALL;

function hasTag(x: DietRow, key: string): boolean {
  if (key === NOTHING_ON_FILE) return x.tags.length === 0;
  if (key.startsWith('any|')) return x.tags.some((t) => t.cat === key.slice(4));
  return x.tags.some((t) => `${t.cat}|${t.text}` === key);
}

const matchLevel = (x: ProfileRow, f: ProfileFilter) => f.level === ALL || x.r.level === f.level;
const matchTags = (x: ProfileRow, f: ProfileFilter) => f.tags.length === 0 || f.tags.some((k) => hasTag(x, k));
const matchPlan = (x: ProfileRow, f: ProfileFilter) => f.plan === ALL || x.plan.id === f.plan;

/**
 * Search: name and apartment first, best matches first (as the tablets
 * search), then anyone whose tags or care assessment wording has it
 * ("mussels").
 */
function search<T extends ProfileRow>(rows: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const named = searchResidents(
    rows.map((x) => ({ name: x.r.name, apt: x.r.apt, x })),
    q,
  ).map((m) => m.x);
  const seen = new Set(named);
  const worded = rows.filter(
    (x) => !seen.has(x) && [...x.tags.flatMap((t) => [t.text, tagLabel(t.text)]), ...x.onFile].join(' ').toLowerCase().includes(q),
  );
  return [...named, ...worded];
}

export function filterProfiles<T extends ProfileRow>(rows: T[], f: ProfileFilter): T[] {
  return search(
    rows.filter((x) => matchLevel(x, f) && matchTags(x, f) && matchPlan(x, f)),
    f.query,
  );
}

export interface Facet {
  id: string;
  label: string;
  n: number;
}

export interface ProfileFacets {
  levels: Facet[];
  /** Each tag, allergies first, then most common. */
  tags: TagCount[];
  /** Residents with any tag of each category, and with nothing on file. */
  categories: Record<TagCategory, number>;
  none: number;
  plans: Facet[];
}

const LEVEL_ORDER = ['IL', 'AL', 'MC', 'SN'];
const levelRank = (l: string) => (LEVEL_ORDER.includes(l) ? LEVEL_ORDER.indexOf(l) : LEVEL_ORDER.length);

/**
 * The choices for each filter with how many residents each would show,
 * given the other filters. Every level, tag and plan anyone has is listed,
 * at 0 when the other filters leave none.
 */
export function profileFacets(rows: ProfileRow[], f: ProfileFilter): ProfileFacets {
  const inQuery = new Set(search(rows, f.query));
  const base = rows.filter((x) => inQuery.has(x));
  const forLevel = base.filter((x) => matchTags(x, f) && matchPlan(x, f));
  const forTags = base.filter((x) => matchLevel(x, f) && matchPlan(x, f));
  const forPlan = base.filter((x) => matchLevel(x, f) && matchTags(x, f));

  const levels = [...new Set(rows.map((x) => x.r.level))]
    .sort((a, b) => levelRank(a) - levelRank(b) || a.localeCompare(b))
    .map((l) => ({ id: l, label: l, n: forLevel.filter((x) => x.r.level === l).length }));

  const tagN = new Map(tagCounts(forTags).map((t) => [t.key, t.n]));
  const tags = tagCounts(rows)
    .map((t) => ({ ...t, n: tagN.get(t.key) ?? 0 }))
    .sort((a, b) => CATEGORY_ORDER[a.cat] - CATEGORY_ORDER[b.cat] || b.n - a.n || a.text.localeCompare(b.text));
  const categories = { allergy: 0, diet: 0, texture: 0 } as Record<TagCategory, number>;
  for (const c of Object.keys(categories) as TagCategory[]) categories[c] = forTags.filter((x) => hasTag(x, anyOf(c))).length;

  // Most used first, by everyone, so the list keeps its order as the counts change.
  const used = new Map<string, Facet>();
  for (const x of rows) used.set(x.plan.id, { ...x.plan, n: (used.get(x.plan.id)?.n ?? 0) + 1 });
  const plans = [...used.values()]
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
    .map((p) => ({ ...p, n: forPlan.filter((x) => x.plan.id === p.id).length }));

  return { levels, tags, categories, none: forTags.filter((x) => x.tags.length === 0).length, plans };
}

/**
 * Allergens the kitchen notes mention that the resident's allergy and diet
 * lists leave out ("NO peanut products" with no peanut allergy on file).
 * The tablets' allergy warnings only use the lists.
 */
export function unlistedAllergens(r: AvoidSource, kitchenNotes: string | null | undefined): AllergenKey[] {
  const onFile = new Set<string>(personAvoids(r).map((a) => a.key));
  return allergenKeysIn(kitchenNotes ?? '').filter((k) => !onFile.has(k));
}

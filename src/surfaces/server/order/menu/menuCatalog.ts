/**
 * How the server's menu is laid out: the category tabs, and inside each
 * tab the items in groups (drink subcategories, entrée types, today's
 * specials, sides then add-ons), each group with its tile colour.
 */
import { getItem, menu } from '../../../../data';
import { isAlcoholFreeName, serverItemName } from '../../../../domain/menu';
import { COCKTAIL_ROOMS } from '../../../../domain/routing';
import type { MealName, MenuItem } from '../../../../domain/types';
import { DEFAULT_CONFIG, type DiningConfig } from '../../../../domain/config';

/** The day of the menu cycle being served today; items on day 0 are on every day. */
export const TODAY_MENU_DAY = 15;

export type MenuTab = 'Drinks' | 'Specials' | 'Starters' | 'Entrees' | 'Sides' | 'Desserts';

/** Entrées and the day's specials both count as mains. */
const MAINS = ['Specials', 'Entrées'];

type MealMenu = Record<string, MenuItem[]>;
const mealMenu = (meal: MealName): MealMenu => menu[meal] ?? {};

export const isToday = (it: Pick<MenuItem, 'day'>) => it.day == null || it.day === 0 || it.day === TODAY_MENU_DAY;

/** __kCats: the tabs this meal's menu has, in service order. */
export function menuTabs(meal: MealName): MenuTab[] {
  const g = mealMenu(meal);
  const mains = MAINS.filter((k) => g[k]);
  const out: MenuTab[] = [];
  if (g.Drinks || g.Beverages || g.Alcohol || g.Cocktails) out.push('Drinks');
  if ([...mains, 'Starters', 'Sides', 'Desserts'].some((k) => (g[k] ?? []).some((i) => i.special))) out.push('Specials');
  if (g.Starters) out.push('Starters');
  if (mains.length) out.push('Entrees');
  if (g.Sides || g['Add-Ons']) out.push('Sides');
  if (g.Desserts) out.push('Desserts');
  return out;
}

/** __kInMains: the item is an entrée (or special) on this meal's menu. */
export function isMain(meal: MealName, itemId: string): boolean {
  const g = mealMenu(meal);
  return MAINS.some((k) => (g[k] ?? []).some((q) => q.id === itemId));
}

/** __kIsDessert */
export function isDessert(meal: MealName, itemId: string): boolean {
  return (mealMenu(meal).Desserts ?? []).some((q) => q.id === itemId);
}

// ─── Drinks ──────────────────────────────────────────────────────────────

export type DrinkGroup = 'Non-Alcoholic' | 'Alcoholic';
export const DRINK_GROUPS: ReadonlyArray<[DrinkGroup, string[]]> = [
  ['Non-Alcoholic', ['Soft Drinks', 'Juice', 'Coffee & Tea', 'Other']],
  ['Alcoholic', ['Beer', 'Wine', 'Cocktails', 'Spirits / Liquor']],
];

/** Tile [background, ink] per drink subcategory. */
const DRINK_TINTS: Record<string, [string, string]> = {
  'Soft Drinks': ['#DDEBF6', '#245C86'],
  Juice: ['#E2EDD8', '#4F6B3A'],
  'Coffee & Tea': ['#E3E4F4', '#434F8C'],
  Other: ['#E6EAEE', '#4A5A66'],
  Beer: ['#F3EAC6', '#7A6420'],
  Wine: ['#F1DDE3', '#8A3550'],
  Cocktails: ['#D8ECEA', '#2E6B66'],
  'Spirits / Liquor': ['#EAE2F0', '#6A4F84'],
};

export type BoozeType = 'beer' | 'wine' | 'cocktail' | 'spirit' | 'na';
const BOOZE_ORDER: BoozeType[] = ['beer', 'wine', 'cocktail', 'spirit', 'na'];
const BOOZE_SUB: Record<BoozeType, string> = { beer: 'Beer', wine: 'Wine', cocktail: 'Cocktails', spirit: 'Spirits / Liquor', na: 'Other' };

/** __kBoozeTypeAuto: beer, wine, cocktail or spirit, read off the name. */
export function boozeType(it: Pick<MenuItem, 'id' | 'name'>): BoozeType {
  const name = getItem(it.id)?.name ?? it.name ?? '';
  if (isAlcoholFreeName(name)) return 'na';
  if (getItem(it.id)?.category === 'Cocktails') return 'cocktail';
  if (/beer|lager|\bipa\b|stout|pilsner|porter|\bale\b/i.test(name)) return 'beer';
  if (
    /wine|merlot|cabernet|chardonnay|pinot|sauvignon|riesling|ros[eé]\b|champagne|prosecco|sangria|blanc|grigio|bubbles|sparkling/i.test(
      name,
    )
  )
    return 'wine';
  if (/margarita|mimosa|bloody mary|martini|mojito|spritz|sour|&|tonic|sunrise/i.test(name)) return 'cocktail';
  return 'spirit';
}

const isAlcoholicItem = (it: MenuItem) => {
  const c = getItem(it.id)?.category;
  return (c === 'Alcohol' || c === 'Cocktails') && !isAlcoholFreeName(it.name);
};

/** __kDrinkSub: the drink's subcategory, from its name. */
export function drinkSubcategory(it: MenuItem): string {
  if (isAlcoholicItem(it)) return BOOZE_SUB[boozeType(it)];
  const n = it.name;
  if (/coffee|espresso|latte|cappuccino|mocha|decaf|\btea\b|chai|cocoa|hot chocolate/i.test(n)) return 'Coffee & Tea';
  if (/juice|smoothie|cider|nectar/i.test(n)) return 'Juice';
  if (/\bcola\b|coke|pepsi|sprite|ginger ale|root beer|soda|lemonade|tonic|seltzer|sparkling|pepper|7.?up/i.test(n)) return 'Soft Drinks';
  return 'Other';
}

/** __kDrinkAll: soft drinks first, then the bar (cocktails only where the venue pours them), each name once. */
function allDrinks(meal: MealName, room: string): MenuItem[] {
  const g = mealMenu(meal);
  const seen = new Set<string>();
  const once = (i: MenuItem) => {
    const k = i.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  };
  const soft = ['Drinks', 'Beverages'].flatMap((k) => g[k] ?? []).filter(once);
  const bar = ['Alcohol', 'Cocktails']
    .flatMap((k) => (k === 'Cocktails' && !COCKTAIL_ROOMS.includes(room) ? [] : (g[k] ?? [])))
    .filter(once);
  return [...soft, ...bar];
}

/** __kDrinkRows: the drink groups with something on this meal's menu, each with its subcategories. */
export function drinkGroups(meal: MealName, room: string): Array<[DrinkGroup, string[]]> {
  const have = new Set(allDrinks(meal, room).map(drinkSubcategory));
  return DRINK_GROUPS.map(([g, subs]) => [g, subs.filter((x) => have.has(x))] as [DrinkGroup, string[]]).filter((x) => x[1].length);
}

/** __kDsGrp: the chosen group, or the first one that exists. */
export function effectiveDrinkGroup(meal: MealName, room: string, chosen: DrinkGroup): DrinkGroup {
  const rows = drinkGroups(meal, room);
  return rows.some((r) => r[0] === chosen) ? chosen : (rows[0]?.[0] ?? chosen);
}

const boozeBase = (it: MenuItem, cfg: DiningConfig) =>
  serverItemName(it.name, cfg)
    .replace(/^BTL\s*-\s*/i, '')
    .replace(/^Glass of\s*/i, '')
    .replace(/\s+(Glass|Bottle)$/i, '')
    .toLowerCase();
const isBottle = (it: MenuItem) => /^BTL\s*-/i.test(it.name);

/** __kBoozeCmp: beer, wine, cocktails, spirits; a glass before its bottle. */
export function compareBooze(a: MenuItem, b: MenuItem, cfg: DiningConfig = DEFAULT_CONFIG): number {
  const r = (t: MenuItem) => BOOZE_ORDER.indexOf(boozeType(t));
  return r(a) - r(b) || boozeBase(a, cfg).localeCompare(boozeBase(b, cfg)) || Number(isBottle(a)) - Number(isBottle(b));
}

// ─── Entrée types ────────────────────────────────────────────────────────

export type EntreeType = 'salad' | 'sandwich' | 'plate' | 'pasta' | 'byo';
/** Entrée types in menu order, with tile [background, ink]. */
export const ENTREE_TYPES: ReadonlyArray<{ key: EntreeType; label: string; tint: [string, string] }> = [
  { key: 'salad', label: 'Entrée Salad', tint: ['#E2EDD8', '#4F6B3A'] },
  { key: 'sandwich', label: 'Sandwiches', tint: ['#F3EAC6', '#7A6420'] },
  { key: 'plate', label: 'Plates', tint: ['#DFE8F1', '#2F5577'] },
  { key: 'pasta', label: 'Pasta', tint: ['#EAE2F0', '#6A4F84'] },
  { key: 'byo', label: 'Build Your Own', tint: ['#D8ECEA', '#2E6B66'] },
];

/**
 * Order matters: build your own first (build your own salad), sandwich
 * before salad (chicken salad sandwich). Anything not placed is a plate.
 */
const ENTREE_RULES: ReadonlyArray<[EntreeType, RegExp]> = [
  ['byo', /build your own|creat(e|ed) your own/i],
  ['sandwich', /sandwich|burger|slider|hot dog|melt|wrap|panini|\bblt\b|\bclub\b|reuben|hoagie|\bsub\b|quesadilla/i],
  ['salad', /salad|caprese|greens/i],
  ['pasta', /pasta|spaghetti|penne|lasagna|linguine|fettuccine|ravioli|macaroni|noodle|scampi|alfredo|gnocchi|bolognese/i],
];

/** __kEntreeType: the recipe's own type, else read off the name. */
export function entreeType(it: Pick<MenuItem, 'name' | 'etype'>): EntreeType {
  if (it.etype && ENTREE_TYPES.some((t) => t.key === it.etype)) return it.etype as EntreeType;
  for (const [k, re] of ENTREE_RULES) if (re.test(it.name)) return k;
  return 'plate';
}

export const entreeTypeInfo = (k: EntreeType) => ENTREE_TYPES.find((t) => t.key === k) ?? ENTREE_TYPES[2];

// ─── Sections ────────────────────────────────────────────────────────────

export type SectionKind = 'specials' | 'everyday' | 'etype' | 'drink' | 'sideSpecial' | 'side' | 'addon' | 'special';

export interface MenuSection {
  key: string;
  kind: SectionKind;
  /** Header text; none for a plain list. */
  label?: string;
  /** Tile [background, ink] for the section's items and header swatch. */
  tint?: [string, string];
  items: MenuItem[];
}

const SPECIAL_GROUPS: ReadonlyArray<[string, string, string]> = [
  ['Starters', 'app', 'Special starters'],
  ['Entrées', 'entree', 'Special entrees'],
  ['Sides', 'side', 'Special sides'],
  ['Desserts', 'dessert', 'Special desserts'],
];

const specialGroupOf = (it: MenuItem) => {
  const c = getItem(it.id)?.category;
  return SPECIAL_GROUPS.find((g) => g[0] === c) ?? SPECIAL_GROUPS[1];
};

/** Group consecutive items into sections by a key. */
function groupBy(items: MenuItem[], keyOf: (it: MenuItem) => string, make: (key: string, items: MenuItem[]) => MenuSection): MenuSection[] {
  const out: MenuSection[] = [];
  for (const it of items) {
    const k = keyOf(it);
    const last = out[out.length - 1];
    if (last && last.key === k) last.items.push(it);
    else out.push(make(k, [it]));
  }
  return out;
}

/**
 * The tab's items in sections. A search looks across the whole meal and
 * lists matches without headers.
 */
export function menuSections(
  meal: MealName,
  tab: MenuTab,
  opts: { drinkGroup: DrinkGroup; room: string; search?: string; cfg?: DiningConfig },
): MenuSection[] {
  const g = mealMenu(meal);
  const cfg = opts.cfg ?? DEFAULT_CONFIG;
  const q = opts.search?.trim().toLowerCase();
  if (q) {
    const hits = Object.values(g)
      .flat()
      .filter((i) => isToday(i) && i.name.toLowerCase().includes(q));
    return hits.length ? [{ key: 'search', kind: 'everyday', items: hits }] : [];
  }
  const byName = (a: MenuItem, b: MenuItem) => a.name.localeCompare(b.name);

  if (tab === 'Drinks') {
    const grp = effectiveDrinkGroup(meal, opts.room, opts.drinkGroup);
    const subs = drinkGroups(meal, opts.room).find((r) => r[0] === grp)?.[1] ?? [];
    const rank = (i: MenuItem) => subs.indexOf(drinkSubcategory(i));
    const list = allDrinks(meal, opts.room)
      .filter((i) => isToday(i) && rank(i) >= 0)
      .map((i, k) => [i, k] as const)
      .sort((a, b) => rank(a[0]) - rank(b[0]) || (grp === 'Alcoholic' ? compareBooze(a[0], b[0], cfg) : 0) || a[1] - b[1])
      .map((x) => x[0]);
    return groupBy(list, drinkSubcategory, (k, items) => ({
      key: k,
      kind: 'drink',
      label: k,
      tint: DRINK_TINTS[k] ?? DRINK_TINTS.Other,
      items,
    }));
  }

  if (tab === 'Specials') {
    const list = ['Starters', ...MAINS, 'Sides', 'Desserts']
      .flatMap((k) => g[k] ?? [])
      .filter((i) => i.special && isToday(i))
      .sort((a, b) => SPECIAL_GROUPS.indexOf(specialGroupOf(a)) - SPECIAL_GROUPS.indexOf(specialGroupOf(b)));
    return groupBy(
      list,
      (i) => specialGroupOf(i)[1],
      (k, items) => ({ key: k, kind: 'special', label: specialGroupOf(items[0])[2], items }),
    );
  }

  if (tab === 'Sides') {
    const sides = (g.Sides ?? []).filter(isToday);
    const addons = (g['Add-Ons'] ?? []).filter(isToday);
    return [
      { key: 'special', kind: 'sideSpecial' as const, label: "Today's special side", items: sides.filter((i) => i.special) },
      { key: 'side', kind: 'side' as const, label: 'Sides', items: sides.filter((i) => !i.special) },
      { key: 'addon', kind: 'addon' as const, label: 'Add-ons', items: addons },
    ].filter((x) => x.items.length);
  }

  const list = (tab === 'Entrees' ? MAINS.flatMap((k) => g[k] ?? []) : (g[tab] ?? [])).filter(isToday);
  const specials = list.filter((i) => i.special);
  const everyday = list.filter((i) => !i.special);
  const head: MenuSection[] = specials.length ? [{ key: 'specials', kind: 'specials', label: "Today's specials", items: specials }] : [];
  if (tab === 'Entrees') {
    const rank = (i: MenuItem) => ENTREE_TYPES.findIndex((t) => t.key === entreeType(i));
    const sorted = everyday.slice().sort((a, b) => rank(a) - rank(b) || byName(a, b));
    return [
      ...head,
      ...groupBy(sorted, entreeType, (k, items) => {
        const t = entreeTypeInfo(k as EntreeType);
        return { key: k, kind: 'etype', label: t.label, tint: t.tint, items };
      }),
    ];
  }
  if (!everyday.length) return head;
  return [...head, { key: 'everyday', kind: 'everyday', label: 'Everyday menu · A to Z', items: everyday.slice().sort(byName) }];
}

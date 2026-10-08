/**
 * The menu as the kiosk offers it: a meal's specials and other main
 * dishes, sides, soups, desserts and drinks, without anything 86'd, plus
 * the plain-language names and short lists residents see.
 */
import { modifierRules, todayCatalog } from '../data';
import { isAlcohol } from './menu';
import type { CatalogItem, MealName, ModSelection } from './types';

// ─── Names ───────────────────────────────────────────────────────────────

/** "COD · Wild Salmon" → "Catch of the Day (Wild Salmon)" */
export function dishLongName(name: string): string {
  const m = /^COD\s*·\s*(.+)$/.exec(name);
  return m ? `Catch of the Day (${m[1]})` : name;
}

/** "Glass of Blanc Mondavi" → "Blanc Mondavi", "Wine Alcohol Free Cab" → "Alcohol-Free Cabernet". */
export function drinkName(it: Pick<CatalogItem, 'name'>): string {
  return it.name
    .replace(/^Glass of\s*/i, '')
    .replace(/^Wine Alcohol Free\s*/i, 'Alcohol-Free ')
    .replace(/\bCab$/, 'Cabernet');
}

/** "a, b and c" (lower case). */
export function listWords(names: string[]): string {
  const low = names.map((n) => n.toLowerCase());
  return low.length < 2 ? low.join('') : `${low.slice(0, -1).join(', ')} and ${low[low.length - 1]}`;
}

// ─── Entrée types and build-your-own ─────────────────────────────────────

export type EntreeType = 'salad' | 'sandwich' | 'plate' | 'pasta' | 'byo';

const ENTREE_TYPES: ReadonlyArray<[EntreeType, string]> = [
  ['salad', 'Entrée Salad'],
  ['sandwich', 'Sandwiches'],
  ['plate', 'Plates'],
  ['pasta', 'Pasta'],
  ['byo', 'Build Your Own'],
];

const ENTREE_RULES: ReadonlyArray<[EntreeType, RegExp]> = [
  ['byo', /build your own|creat(e|ed) your own/i],
  ['sandwich', /sandwich|burger|slider|hot dog|melt|wrap|panini|\bblt\b|\bclub\b|reuben|hoagie|\bsub\b|quesadilla/i],
  ['salad', /salad|caprese|greens/i],
  ['pasta', /pasta|spaghetti|penne|lasagna|linguine|fettuccine|ravioli|macaroni|noodle|scampi|alfredo|gnocchi|bolognese/i],
];

/** The item's entrée type, from its recipe or else guessed from its name. */
export function entreeType(it: Pick<CatalogItem, 'name' | 'etype'>): EntreeType {
  const own = ENTREE_TYPES.find(([k]) => k === it.etype);
  if (own) return own[0];
  return ENTREE_RULES.find(([, re]) => re.test(it.name))?.[0] ?? 'plate';
}

/** A ready-made version of a build-your-own dish: [name, picks by modifier group, description]. */
type Preset = [string, Record<string, string[]>, string?];

export interface DishVersion {
  name: string;
  picks: Record<string, string[]>;
  desc: string;
  /** "Veggie Pizza", "Chef's Salad" */
  title: string;
}

const presetsOf = (it: CatalogItem): Preset[] => (Array.isArray(it.presets) ? (it.presets as Preset[]) : []);

/**
 * Pizza, salad, deli sandwich and omelet come to the kiosk only as their
 * ready-made versions: the resident picks one, sees what it comes with, and
 * asks for anything different on the Changes step.
 */
export function isBuildYourOwn(it: CatalogItem | undefined): boolean {
  return !!it && it.etype === 'byo' && presetsOf(it).length > 0;
}

const lastWord = (it: CatalogItem) => it.name.trim().split(/\s+/).pop() ?? '';

/** "Pizza" for "Build Your Own Pizza", for "Which pizza would you like?" */
export const dishNoun = lastWord;

export function dishVersions(it: CatalogItem | undefined): DishVersion[] {
  if (!it) return [];
  return presetsOf(it).map(([name, picks, desc]) => ({
    name,
    picks,
    desc: desc ?? '',
    title: /pizza|salad|sandwich|omelet|croissant/i.test(name) ? name : `${name} ${lastWord(it)}`,
  }));
}

/**
 * A version's choices as the line's modifiers, by group name, so the kitchen
 * and the staff Modify screen read it as they read a server's build. Picks
 * that aren't options of the group are dropped and each group keeps at most
 * its limit.
 */
export function versionMods(itemId: string, v: DishVersion | null): ModSelection {
  if (!v) return {};
  const out: ModSelection = {};
  for (const gid of modifierRules.items[itemId] ?? []) {
    const g = modifierRules.groups[gid];
    if (!g) continue;
    const ok = new Set(g.options.map((o) => o.name));
    let picks = (v.picks[gid] ?? []).filter((x) => ok.has(x));
    if (g.rule.max) picks = picks.slice(0, g.rule.max);
    if (picks.length) out[g.name] = g.rule.max === 1 ? picks[0] : picks;
  }
  return out;
}

// ─── Modifiers from words ────────────────────────────────────────────────

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

/** Each modifier group's default choice. */
export function defaultMods(it: CatalogItem | undefined): ModSelection {
  const m: ModSelection = {};
  for (const g of it?.mods ?? []) if (g.group && g.default) m[g.group] = g.default;
  return m;
}

/**
 * Changes typed or said pick a real modifier only on a clear match of the
 * option's own words ("blackened", "no cheese", "well done"); the whole
 * sentence still goes on the line as the note, so nothing said is lost.
 */
export function modsFromWords(it: CatalogItem | undefined, text: string): ModSelection {
  const t = norm(text);
  const m: ModSelection = {};
  for (const g of it?.mods ?? []) {
    const hit = [...(g.opts ?? [])].sort((a, b) => b.length - a.length).find((o) => t.includes(norm(o)));
    if (g.group && hit) m[g.group] = hit;
  }
  return m;
}

const CHANGE_CHIPS = {
  pizza: ['Light cheese', 'Extra cheese', 'Well done', 'Cut in small squares', 'No onions', 'No olives'],
  salad: ['Dressing on the side', 'No onions', 'No croutons', 'No cheese', 'Extra dressing', 'Chopped small'],
  sandwich: ['No onions', 'Toasted', 'Cut in half', 'Mayo on the side', 'No cheese', 'No tomato'],
  egg: ['Egg whites only', 'Well done', 'No cheese', 'No onions', 'Light butter', 'Cut up'],
  any: ['No onions', 'Sauce on the side', 'Cut up', 'No salt', 'Well done', 'Dressing on the side'],
};

/** The common changes offered for the dish in hand; anything else goes in the comment box. */
export function changeChips(it: CatalogItem | undefined): string[] {
  const t = (it?.name ?? '').toLowerCase();
  const e = it?.etype;
  if (/pizza/.test(t)) return CHANGE_CHIPS.pizza;
  if (e === 'salad' || /salad/.test(t)) return CHANGE_CHIPS.salad;
  if (e === 'sandwich' || /sandwich|burger|wrap|quesadilla/.test(t)) return CHANGE_CHIPS.sandwich;
  if (/omelet|egg/.test(t)) return CHANGE_CHIPS.egg;
  return CHANGE_CHIPS.any;
}

// ─── A meal's menu ───────────────────────────────────────────────────────

export interface KioskMenu {
  meal: MealName;
  /** Special main dishes, offered one at a time first. */
  specials: CatalogItem[];
  /** Ready-made versions to choose from: pizza, salads and more. */
  buildYourOwn: CatalogItem[];
  /** Every other main dish by type, A to Z. */
  others: Array<[string, CatalogItem[]]>;
  sides: CatalogItem[];
  /** Soups, the special first. */
  soups: CatalogItem[];
  desserts: CatalogItem[];
  /** Coffee, juice, soft drinks, milk, water and alcohol-free wine. */
  drinks: CatalogItem[];
  /** Beer, wine and spirits, behind their own button. */
  alcohol: CatalogItem[];
}

const SOUP = /soup|chowder|bisque|chili|gumbo/i;
const isBottle = (it: CatalogItem) => /^BTL\s*-/i.test(it.name);

/**
 * What the kiosk offers for a meal; `isOut` hides what the kitchen 86'd.
 * Only that day's menu: the dining room's every-day items and the day's
 * specials (a special taken off in Menu Cycle, or another day's, is not
 * offered). Today's unless `date` ("YYYY-MM-DD") is a later day, for an
 * order booked for tomorrow.
 */
export function kioskMenu(meal: MealName, isOut: (id: string) => boolean, date?: string | null): KioskMenu {
  const items = todayCatalog(null, date).filter((it) => it.meal === meal && !isOut(it.id) && it.category !== 'Snacks');
  const inCat = (...cats: string[]) => items.filter((it) => cats.includes(it.category));
  const mains = inCat('Specials', 'Entrées');
  const regular = mains.filter((it) => !it.special);
  const others = ENTREE_TYPES.map(([k, label]): [string, CatalogItem[]] => [
    label,
    regular.filter((it) => entreeType(it) === k && !isBuildYourOwn(it)).sort((a, b) => a.name.localeCompare(b.name)),
  ]).filter(([, l]) => l.length > 0);
  const drinkPool = inCat('Drinks', 'Beverages', 'Cocktails', 'Alcohol').filter((it) => !isBottle(it));
  return {
    meal,
    specials: mains.filter((it) => it.special),
    buildYourOwn: regular.filter(isBuildYourOwn),
    others,
    sides: inCat('Sides'),
    soups: inCat('Starters')
      .filter((it) => SOUP.test(it.name))
      .sort((a, b) => Number(!!b.special) - Number(!!a.special)),
    desserts: inCat('Desserts'),
    drinks: drinkPool.filter((it) => !isAlcohol(it.id)),
    alcohol: drinkPool.filter((it) => isAlcohol(it.id)),
  };
}

// ─── Short lists and groups ──────────────────────────────────────────────

/** How many drinks or sides the short list shows before More. */
export const FEATURED_COUNT = 9;

/** The standard picks until Back Office orders its own. */
export const FEATURED_DEFAULTS: Record<'drinks' | 'sides', string[]> = {
  drinks: ['Coffee', 'Decaf Coffee', 'Hot Tea', 'Iced Tea', 'Water', 'Orange Juice', 'Apple Juice', '2% Milk', 'Diet Coke', 'Coca-Cola', 'Sugar-Free Lemonade'],
  sides: ['Steamed Broccoli', 'Baked Potato', 'French Fries', 'Side Salad', 'Fresh Fruit', 'Rice Pilaf', 'Garlic Green Beans', 'Sweet Potato Fries', 'Coleslaw', 'Hashbrowns', '2 Strips Bacon', '2 Sausage Links', 'Toast', 'English Muffin'],
};

/**
 * The short list: the featured names that are on this meal's menu, in
 * order, filled from the menu so a meal never opens on a short, odd list,
 * and always including what the resident already picked.
 */
export function shortList(names: string[], pool: CatalogItem[], currentId?: string | null): CatalogItem[] {
  const byName = new Map(pool.map((i) => [i.name, i]));
  let list = [...new Set(names.map((n) => byName.get(n)).filter((i): i is CatalogItem => !!i))];
  for (const i of pool) {
    if (list.length >= FEATURED_COUNT) break;
    if (!list.includes(i)) list.push(i);
  }
  list = list.slice(0, FEATURED_COUNT);
  const cur = currentId ? pool.find((i) => i.id === currentId) : undefined;
  if (cur && !list.includes(cur)) list = [cur, ...list.slice(0, FEATURED_COUNT - 1)];
  return list;
}

/** Items under headings in a fixed order; empty headings drop out. */
export function groupItems(items: CatalogItem[], groupOf: (it: CatalogItem) => string, order: readonly string[]): Array<[string, CatalogItem[]]> {
  const by = new Map<string, CatalogItem[]>();
  for (const it of items) {
    const g = groupOf(it);
    by.set(g, [...(by.get(g) ?? []), it]);
  }
  return order.filter((g) => by.has(g)).map((g) => [g, by.get(g)!]);
}

export const DRINK_GROUPS = ['Coffee & tea', 'Juice & lemonade', 'Soft drinks', 'Milk', 'Water', 'Alcohol-free wine'] as const;
export const ALCOHOL_GROUPS = ['Beer', 'Wine', 'Spirits'] as const;
export const SIDE_GROUPS = ['Vegetables', 'Potatoes, rice & bread', 'Fried', 'Salads', 'Fruit', 'Breakfast meats', 'Also available'] as const;

export function drinkGroup(it: CatalogItem): string {
  const t = it.name.toLowerCase();
  if (/alcohol.free|\bna\b|no alcohol/.test(t)) return 'Alcohol-free wine';
  if (/coffee|\btea\b|cocoa|chocolate/.test(t)) return 'Coffee & tea';
  if (/juice|lemonade/.test(t)) return 'Juice & lemonade';
  if (/milk/.test(t)) return 'Milk';
  if (/water/.test(t)) return 'Water';
  return 'Soft drinks';
}

export function alcoholGroup(it: CatalogItem): string {
  const t = it.name.toLowerCase();
  if (/\bale\b|lager|beer|\bipa\b|stout|pilsner|corona|modelo/.test(t)) return 'Beer';
  if (/wine|chardonnay|cabernet|merlot|pinot|grigio|blanc|riesling|ros[eé]|sauvignon|zinfandel|moscato|prosecco|champagne|mondavi/.test(t)) return 'Wine';
  return 'Spirits';
}

export function sideGroup(it: CatalogItem): string {
  const t = it.name.toLowerCase();
  if (/salad|slaw/.test(t)) return 'Salads';
  if (/fries|onion rings|tots/.test(t)) return 'Fried';
  if (/potato|hashbrown|rice|pilaf|yam|pasta|noodle|\bmac\b|knot|toast|bread|biscuit|muffin|bagel|roll|pastry|grits/.test(t)) return 'Potatoes, rice & bread';
  if (/broccoli|asparagus|bean|carrot|\bpeas?\b|corn|spinach|tomato|celery|squash|zucchini|vegetable|mushroom|cauliflower|brussels/.test(t)) return 'Vegetables';
  if (/fruit|applesauce|berr|melon|banana|avocado/.test(t)) return 'Fruit';
  if (/bacon|sausage|\bham\b/.test(t)) return 'Breakfast meats';
  return 'Also available';
}

/**
 * Menu groups and subcategories, as the KDS screens and Kitchen Routing see
 * them.
 *
 * Every recipe sits in a group (Starters, Entrees, Sides, Desserts ...) and,
 * within it, a subcategory (Soup, Plates, Potato ...). A KDS screen shows
 * the subcategories ticked for it, so the subcategory decides which cook
 * screen a plate goes to. An entree's subcategory is its entree type, which
 * also sets its colour on the server's menu.
 *
 * A Back Office choice (service setting `csub`, keyed by the recipe's
 * canonical id) wins; otherwise the recipe's own type; otherwise a guess
 * from the dish name.
 */
import { catalog, getItem } from '../data';

export type MenuGroup = 'Drinks' | 'Starters' | 'Entrees' | 'Sides' | 'Desserts' | 'Snacks';

/** The groups a cook screen can be given. */
export const KDS_GROUPS = ['Starters', 'Entrees', 'Sides', 'Desserts'] as const;
export type KdsGroup = (typeof KDS_GROUPS)[number];

export const SUBCATEGORIES: Record<KdsGroup, readonly string[]> = {
  Starters: ['Soup', 'Salad', 'Cold Appetizer', 'Hot Appetizer', 'Bread', 'Shareable'],
  Entrees: ['Entrée Salad', 'Sandwiches', 'Plates', 'Pasta', 'Build Your Own'],
  Sides: ['Vegetable', 'Potato', 'Rice / Grain', 'Pasta', 'Side Salad', 'Fruit', 'Bread', 'Other Hot Side', 'Other Cold Side'],
  Desserts: ['Cake / Pie', 'Cookie / Bar', 'Ice Cream / Frozen', 'Pudding / Custard', 'Fruit', 'Hot Dessert', 'Other Dessert'],
};

/** Label for a group heading ("Entrées"). */
export function groupLabel(g: string): string {
  return g === 'Entrees' ? 'Entrées' : g;
}

const isKdsGroup = (g: string): g is KdsGroup => (KDS_GROUPS as readonly string[]).includes(g);

/** Every "Group|Subcategory" key a cook screen can be given. */
export function allKdsKeys(): string[] {
  return KDS_GROUPS.flatMap((g) => SUBCATEGORIES[g].map((s) => g + '|' + s));
}

// ─── Groups ──────────────────────────────────────────────────────────────

type TabGroup = 'app' | 'entree' | 'side' | 'dessert' | 'drink' | 'alc' | 'fee' | 'other';

/** The tablet menu's own grouping of a category, used to tell recipes apart. */
function tabGroup(category: string): TabGroup {
  switch (category) {
    case 'Starters':
      return 'app';
    case 'Specials':
    case 'Entrées':
      return 'entree';
    case 'Sides':
    case 'Add-Ons':
      return 'side';
    case 'Desserts':
      return 'dessert';
    case 'Drinks':
    case 'Beverages':
      return 'drink';
    case 'Alcohol':
    case 'Cocktails':
      return 'alc';
    case 'Fees':
      return 'fee';
    default:
      return 'other';
  }
}

/** The menu group a tablet menu category files under. */
export function menuGroupOf(category: string): MenuGroup {
  const g = tabGroup(category);
  if (g === 'app') return 'Starters';
  if (g === 'side') return 'Sides';
  if (g === 'dessert') return 'Desserts';
  if (g === 'drink' || g === 'alc') return 'Drinks';
  if (g === 'fee') return 'Snacks';
  return 'Entrees';
}

/** Entrée categories on the tablet menu. */
export function isMainCategory(category: string): boolean {
  return category === 'Specials' || category === 'Entrées';
}

// ─── One recipe across meals ─────────────────────────────────────────────

/**
 * A dish on several meals' menus has one id per meal. The Back Office
 * treats them as one recipe: the first id seen for the same name in the
 * same menu group.
 */
const canonicalById = new Map<string, string>();
const idsByCanonical = new Map<string, string[]>();
{
  const firstByKey = new Map<string, string>();
  for (const it of catalog) {
    const key = it.name.toLowerCase() + '|' + tabGroup(it.category);
    const canon = firstByKey.get(key) ?? it.id;
    firstByKey.set(key, canon);
    if (!canonicalById.has(it.id)) canonicalById.set(it.id, canon);
    const ids = idsByCanonical.get(canon) ?? [];
    if (!ids.includes(it.id)) ids.push(it.id);
    idsByCanonical.set(canon, ids);
  }
}

/** The recipe id shared by every meal's copy of a dish. */
export function canonicalItemId(itemId: string): string {
  return canonicalById.get(itemId) ?? itemId;
}

/** Every menu id that is the same recipe. */
export function recipeItemIds(itemId: string): string[] {
  return idsByCanonical.get(canonicalItemId(itemId)) ?? [itemId];
}

// ─── Entree types ────────────────────────────────────────────────────────

export type EntreeTypeId = 'salad' | 'sandwich' | 'plate' | 'pasta' | 'byo';

export interface EntreeType {
  id: EntreeTypeId;
  /** The entree subcategory it stands for. */
  label: string;
  /** Tint and ink, the same as the server's menu. */
  bg: string;
  fg: string;
}

export const ENTREE_TYPES: readonly EntreeType[] = [
  { id: 'salad', label: 'Entrée Salad', bg: '#E2EDD8', fg: '#4F6B3A' },
  { id: 'sandwich', label: 'Sandwiches', bg: '#F3EAC6', fg: '#7A6420' },
  { id: 'plate', label: 'Plates', bg: '#DFE8F1', fg: '#2F5577' },
  { id: 'pasta', label: 'Pasta', bg: '#EAE2F0', fg: '#6A4F84' },
  { id: 'byo', label: 'Build Your Own', bg: '#D8ECEA', fg: '#2E6B66' },
];

/** Checked in order: "build your own" before sandwiches, sandwiches before salads ("salad sandwich"). */
const ENTREE_TYPE_RULES: ReadonlyArray<[EntreeTypeId, RegExp]> = [
  ['byo', /build your own|creat(e|ed) your own/i],
  ['sandwich', /sandwich|burger|slider|hot dog|melt|wrap|panini|\bblt\b|\bclub\b|reuben|hoagie|\bsub\b|quesadilla/i],
  ['salad', /salad|caprese|greens/i],
  ['pasta', /pasta|spaghetti|penne|lasagna|linguine|fettuccine|ravioli|macaroni|noodle|scampi|alfredo|gnocchi|bolognese/i],
];

export function entreeTypeById(id: string | null | undefined): EntreeType {
  return ENTREE_TYPES.find((t) => t.id === id) ?? ENTREE_TYPES[2];
}

const isEntreeTypeId = (v: unknown): v is EntreeTypeId => ENTREE_TYPES.some((t) => t.id === v);

/** The entree type the dish name suggests. */
export function suggestedEntreeType(name: string): EntreeTypeId {
  for (const [id, re] of ENTREE_TYPE_RULES) if (re.test(name)) return id;
  return 'plate';
}

/** Back Office subcategory choices, keyed by canonical recipe id. */
export type SubcategoryChoices = Record<string, string>;

/** The entree type a recipe shows as: chosen by hand, else the recipe's own, else suggested. */
export function entreeTypeOf(itemId: string, choices: SubcategoryChoices): EntreeTypeId {
  const chosen = ENTREE_TYPES.find((t) => t.label === choices[canonicalItemId(itemId)]);
  if (chosen) return chosen.id;
  const it = getItem(itemId);
  if (it && isEntreeTypeId(it.etype)) return it.etype;
  return suggestedEntreeType(it?.name ?? '');
}

/** Was the recipe's entree type chosen in the Back Office? */
export function entreeTypeChosen(itemId: string, choices: SubcategoryChoices): boolean {
  return ENTREE_TYPES.some((t) => t.label === choices[canonicalItemId(itemId)]);
}

// ─── Subcategories ───────────────────────────────────────────────────────

/** Name rules per group, checked in order; the first match wins. */
const SUB_RULES: Partial<Record<KdsGroup, ReadonlyArray<[string, RegExp]>>> = {
  Starters: [
    ['Soup', /soup|chowder|bisque|chili|gumbo|stew|broth/i],
    ['Salad', /salad|greens|caesar|wedge/i],
    ['Bread', /bread|\broll|biscuit|muffin|toast|scone|croissant/i],
    ['Shareable', /board|platter|sampler|nachos|flatbread|charcuterie|basket|to share/i],
    ['Cold Appetizer', /cocktail|caprese|hummus|bruschetta|deviled|tartare|carpaccio|ceviche|crudit|\bdip\b|fruit|yogurt|parfait|cold/i],
  ],
  Sides: [
    ['Side Salad', /salad|slaw/i],
    ['Potato', /potato|fries|mashed|tots|wedges|hash/i],
    ['Rice / Grain', /rice|quinoa|grain|pilaf|couscous|farro|oat/i],
    ['Pasta', /pasta|macaroni|\bmac\b|noodle|orzo/i],
    ['Fruit', /fruit|berries|melon|applesauce|banana/i],
    ['Bread', /bread|\broll|biscuit|toast|muffin|croissant|bagel|pastry|garlic knot/i],
    ['Other Cold Side', /cottage cheese|chips|pickle|relish|condiment|dressing|sauce|salsa|avocado/i],
    ['Vegetable', /veg|broccoli|tomato|celery|asparagus|carrot|green bean|corn|peas|sprouts|spinach|squash|zucchini|cauliflower|beet|kale|collard|okra/i],
  ],
  Desserts: [
    ['Pudding / Custard', /pudding|custard|flan|cr[eè]me|br[uû]l[eé]e|mousse|panna cotta|parfait|trifle|jell-?o|gelatin|yogurt/i],
    ['Ice Cream / Frozen', /ice cream|sorbet|sherbet|frozen|sundae|gelato|float|shake/i],
    ['Cookie / Bar', /cookie|brownie|\bbars?\b|blondie|biscotti/i],
    ['Hot Dessert', /cobbler|crisp|crumble|lava|warm|hot fudge|baked apple/i],
    ['Cake / Pie', /cake|\bpie\b|tart|cheesecake|torte/i],
    ['Fruit', /fruit|berries|melon|banana/i],
  ],
};
const SUB_FALLBACK: Partial<Record<KdsGroup, string>> = {
  Starters: 'Hot Appetizer',
  Sides: 'Other Hot Side',
  Desserts: 'Other Dessert',
};

/** A recipe's subcategory within a group. */
export function subcategoryOf(itemId: string, group: string, choices: SubcategoryChoices): string {
  if (!isKdsGroup(group)) return '';
  const subs = SUBCATEGORIES[group];
  const chosen = choices[canonicalItemId(itemId)];
  if (chosen && subs.includes(chosen)) return chosen;
  if (group === 'Entrees') return entreeTypeById(entreeTypeOf(itemId, choices)).label;
  const name = getItem(itemId)?.name ?? '';
  for (const [sub, re] of SUB_RULES[group] ?? []) if (re.test(name)) return sub;
  return SUB_FALLBACK[group] ?? subs[0];
}

/**
 * The "Group|Subcategory" a dish files under on a cook screen. A special
 * is filed by what kind of plate it is.
 */
export function kdsKeyOf(itemId: string, choices: SubcategoryChoices): string {
  const it = getItem(itemId);
  if (!it) return '';
  const group: MenuGroup =
    it.category === 'Specials'
      ? it.entree
        ? 'Entrees'
        : it.course === 1
          ? 'Starters'
          : it.course === 3
            ? 'Desserts'
            : 'Sides'
      : menuGroupOf(it.category);
  return group + '|' + subcategoryOf(itemId, group, choices);
}

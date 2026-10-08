/**
 * Recipe categories, subcategories and proteins, and the rules that guess
 * them from a dish name when a chef has not picked one.
 */
import type { Recipe, RecipeCategory } from '../../../../store/menuEdits';

interface CategoryDef {
  id: RecipeCategory;
  /** Course the category rings in on (0 = no course). */
  course: number;
  /** Subcategory groups: [group label, subcategories]. */
  groups: Array<[string, string[]]>;
}

export const CATEGORY_DEFS: CategoryDef[] = [
  {
    id: 'Drinks',
    course: 0,
    groups: [
      ['Non-Alcoholic', ['Soft Drinks', 'Juice', 'Coffee & Tea', 'Other']],
      ['Alcoholic', ['Beer', 'Wine', 'Cocktails', 'Spirits / Liquor']],
    ],
  },
  { id: 'Starters', course: 1, groups: [['', ['Soup', 'Salad', 'Cold Appetizer', 'Hot Appetizer', 'Bread', 'Shareable']]] },
  { id: 'Entrees', course: 2, groups: [['', ['Entrée Salad', 'Sandwiches', 'Plates', 'Pasta', 'Build Your Own']]] },
  {
    id: 'Sides',
    course: 2,
    groups: [['', ['Vegetable', 'Potato', 'Rice / Grain', 'Pasta', 'Side Salad', 'Fruit', 'Bread', 'Other Hot Side', 'Other Cold Side']]],
  },
  {
    id: 'Desserts',
    course: 3,
    groups: [['', ['Cake / Pie', 'Cookie / Bar', 'Ice Cream / Frozen', 'Pudding / Custard', 'Fruit', 'Hot Dessert', 'Other Dessert']]],
  },
  { id: 'Snacks', course: 0, groups: [] },
];

export const CATEGORIES: RecipeCategory[] = CATEGORY_DEFS.map((c) => c.id);

/** Labels used where a category reads as a menu section. */
export const CATEGORY_LABEL: Record<RecipeCategory, string> = {
  Drinks: 'Drinks',
  Starters: 'Starters',
  Entrees: 'Entrées',
  Sides: 'Sides',
  Desserts: 'Desserts',
  Snacks: 'Snacks',
};

/** A category as people read it ("Entrées"); the stored id stays "Entrees". */
export function categoryLabel(c: string): string {
  return CATEGORY_LABEL[c as RecipeCategory] ?? c;
}

const LEGACY: Record<string, RecipeCategory> = {
  Appetizer: 'Starters',
  Salad: 'Entrees',
  Entree: 'Entrees',
  Side: 'Sides',
  Bread: 'Sides',
  Condiments: 'Sides',
  Dessert: 'Desserts',
  Beverage: 'Drinks',
  Alcohol: 'Drinks',
  Fee: 'Snacks',
  Snack: 'Snacks',
  Specials: 'Entrees',
  Entrées: 'Entrees',
};

/** Any category name (including older ones) as one of the six; unknown counts as Entrees. */
export function normCategory(c: string | null | undefined): RecipeCategory {
  if (!c) return 'Entrees';
  if ((CATEGORIES as string[]).includes(c)) return c as RecipeCategory;
  return LEGACY[c] ?? 'Entrees';
}

function catDef(c: string): CategoryDef {
  return CATEGORY_DEFS.find((d) => d.id === normCategory(c)) ?? CATEGORY_DEFS[2];
}

export function categoryCourse(c: string): number {
  return catDef(c).course;
}

export function subcategories(c: string): string[] {
  return catDef(c).groups.flatMap((g) => g[1]);
}

export function subcategoryGroups(c: string): Array<[string, string[]]> {
  return catDef(c).groups;
}

/** "Alcoholic" or "Non-Alcoholic" for drinks, "" otherwise. */
export function subGroup(c: string, sub: string): string {
  return catDef(c).groups.find((g) => g[1].includes(sub))?.[0] ?? '';
}

// ─── Entrée types (the server menu's colours) ────────────────────────────

const ENTREE_TYPES: Array<[string, string, string, string]> = [
  ['salad', 'Entrée Salad', '#E2EDD8', '#4F6B3A'],
  ['sandwich', 'Sandwiches', '#F3EAC6', '#7A6420'],
  ['plate', 'Plates', '#DFE8F1', '#2F5577'],
  ['pasta', 'Pasta', '#EAE2F0', '#6A4F84'],
  ['byo', 'Build Your Own', '#D8ECEA', '#2E6B66'],
];
const ENTREE_RULES: Array<[string, RegExp]> = [
  ['byo', /build your own|creat(e|ed) your own/i],
  ['sandwich', /sandwich|burger|slider|hot dog|melt|wrap|panini|\bblt\b|\bclub\b|reuben|hoagie|\bsub\b|quesadilla/i],
  ['salad', /salad|caprese|greens/i],
  ['pasta', /pasta|spaghetti|penne|lasagna|linguine|fettuccine|ravioli|macaroni|noodle|scampi|alfredo|gnocchi|bolognese/i],
];
const DRINK_TYPES: Array<[string, string, string, string]> = [
  ['beer', 'Beer', '#F3EAC6', '#7A6420'],
  ['wine', 'Wine', '#F1DDE3', '#8A3550'],
  ['cocktail', 'Cocktails', '#D8ECEA', '#2E6B66'],
  ['spirit', 'Spirits / Liquor', '#EAE2F0', '#6A4F84'],
];

/** The tablet's entrée type key for an entrée subcategory ("Plates" → "plate"). */
export function subToEntreeType(sub: string | undefined): string | undefined {
  return ENTREE_TYPES.find((t) => t[1] === sub)?.[0];
}

function entreeTypeAuto(name: string): string {
  for (const [k, re] of ENTREE_RULES) if (re.test(name)) return k;
  return 'plate';
}

/** Alcohol-free products listed with the alcohol (root beer, NA wine). */
export function isAlcoholFree(name: string): boolean {
  return /root beer|alcohol free|non-alcoholic|no alcohol|\bNA\b/i.test(name);
}

function isAlcoholic(name: string): boolean {
  return (
    !isAlcoholFree(name) &&
    !/ginger ale|root beer/i.test(name) &&
    /wine|beer|\bale\b|lager|\bipa\b|stout|pilsner|margarita|martini|mojito|spritz|cocktail|whisk|bourbon|vodka|\bgin\b|\brum\b|tequila|sangria|mimosa|champagne|prosecco|merlot|cabernet|chardonnay|pinot|sauvignon|riesling|scotch|brandy|cognac/i.test(
      name,
    )
  );
}

function drinkTypeAuto(name: string): string {
  if (/beer|lager|\bipa\b|stout|pilsner|porter|\bale\b/i.test(name)) return 'Beer';
  if (/wine|merlot|cabernet|chardonnay|pinot|sauvignon|riesling|ros[eé]\b|champagne|prosecco|sangria|blanc|grigio|bubbles|sparkling/i.test(name)) return 'Wine';
  if (/margarita|mimosa|bloody mary|martini|mojito|spritz|sour|&|tonic|sunrise/i.test(name)) return 'Cocktails';
  return 'Spirits / Liquor';
}

const SUB_RULES: Partial<Record<RecipeCategory, Array<[string, RegExp]>>> = {
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
const SUB_DEFAULT: Partial<Record<RecipeCategory, string>> = { Starters: 'Hot Appetizer', Sides: 'Other Hot Side', Desserts: 'Other Dessert' };

/** The subcategory a dish name suggests, for a category. */
export function guessSubcategory(c: string, name: string): string {
  const cat = normCategory(c);
  if (cat === 'Drinks') {
    if (isAlcoholic(name)) return drinkTypeAuto(name);
    if (/coffee|espresso|latte|cappuccino|mocha|decaf|\btea\b|chai|cocoa|hot chocolate/i.test(name)) return 'Coffee & Tea';
    if (/juice|smoothie|cider|nectar/i.test(name)) return 'Juice';
    if (/\bcola\b|coke|pepsi|sprite|ginger ale|root beer|soda|lemonade|tonic|seltzer|sparkling|pepper|7.?up/i.test(name)) return 'Soft Drinks';
    return 'Other';
  }
  if (cat === 'Entrees') return ENTREE_TYPES.find((t) => t[0] === entreeTypeAuto(name))![1];
  for (const [s, re] of SUB_RULES[cat] ?? []) if (re.test(name)) return s;
  return SUB_DEFAULT[cat] ?? '';
}

/** The recipe's subcategory: the one picked, else the guess, else the first. */
export function subOf(r: Pick<Recipe, 'cat' | 'name' | 'sub'>): string {
  const subs = subcategories(r.cat);
  if (!subs.length) return '';
  if (r.sub && subs.includes(r.sub)) return r.sub;
  const g = guessSubcategory(r.cat, r.name);
  return subs.includes(g) ? g : subs[0];
}

/** Chip colours [background, text] for a subcategory. */
export function subColor(c: string, sub: string): [string, string] {
  const cat = normCategory(c);
  if (cat === 'Entrees') {
    const t = ENTREE_TYPES.find((x) => x[1] === sub) ?? ENTREE_TYPES[2];
    return [t[2], t[3]];
  }
  if (cat === 'Drinks') {
    const t = DRINK_TYPES.find((x) => x[1] === sub);
    return t ? [t[2], t[3]] : ['#E4EEF6', '#3E6A8A'];
  }
  return ['#ECEFF3', '#3A4751'];
}

/** "Entrees · Plates" */
export function categoryWithSub(r: Pick<Recipe, 'cat' | 'name' | 'sub'>): string {
  const s = subOf(r);
  return categoryLabel(r.cat) + (s ? ' · ' + s : '');
}

// ─── Proteins ─────────────────────────────────────────────────────────────

/**
 * Entrée proteins. Chicken and turkey, and fish and shellfish, are separate
 * so the menu can be balanced and residents can find them. Other is for
 * build-your-own plates and the pureed meal.
 */
export const PROTEINS: Array<{ id: string; label: string; short: string }> = [
  { id: 'chicken', label: 'Chicken', short: 'Chicken' },
  { id: 'turkey', label: 'Turkey', short: 'Turkey' },
  { id: 'beef', label: 'Beef', short: 'Beef' },
  { id: 'pork', label: 'Pork', short: 'Pork' },
  { id: 'lamb', label: 'Lamb', short: 'Lamb' },
  { id: 'fish', label: 'Fish', short: 'Fish' },
  { id: 'shellfish', label: 'Shellfish', short: 'Shellfish' },
  { id: 'egg', label: 'Egg', short: 'Egg' },
  { id: 'veg', label: 'Vegetarian / plant-based', short: 'Vegetarian' },
  { id: 'other', label: 'Other', short: 'Other' },
];

const PROTEIN_RULES: Array<[string, RegExp]> = [
  ['veg', /beyond|impossible|plant.based|eggplant|vegetarian|vegan|veggie|tofu|tempeh|falafel|grilled cheese|caprese/i],
  ['shellfish', /shrimp|scampi|prawn|crab\b|lobster|scallop|clam|mussel|oyster|cioppino|etouffee|seafood/i],
  ['fish', /salmon|fish|\bcod\b|tuna|sushi|catch|tilapia|trout|sole|halibut|flounder|mahi|bass|rockfish|snapper|krab/i],
  ['lamb', /lamb|gyro|mutton/i],
  ['turkey', /turkey/i],
  ['beef', /chicken fried steak/i],
  ['chicken', /chicken|duck|\bhen\b|coq au vin/i],
  ['beef', /beef|steak|filet|burger|short rib|meatloaf|brisket|sirloin|prime rib|pot roast|veal/i],
  ['pork', /pork|\bham\b|bacon|\bblt\b|sausage|hot dog|prosciutto|brat|kielbasa|carnitas/i],
  ['egg', /quiche|omelet|frittata|strata|benedict|\beggs?\b/i],
];

export function guessProtein(name: string): string {
  for (const [k, re] of PROTEIN_RULES) if (re.test(name)) return k;
  return 'other';
}

/** An entrée's protein: the one picked, else the guess. */
export function proteinOf(r: Pick<Recipe, 'cat' | 'name' | 'protein'>): string | null {
  if (normCategory(r.cat) !== 'Entrees') return null;
  return r.protein && PROTEINS.some((p) => p.id === r.protein) ? r.protein : guessProtein(r.name);
}

export function proteinLabel(id: string | null | undefined, short = false): string {
  const p = PROTEINS.find((x) => x.id === id);
  return p ? (short ? p.short : p.label) : '';
}

/** Protein group for menu balance: fish and shellfish are seafood, egg counts as vegetarian. */
export function proteinBalance(id: string | null | undefined): string {
  return id === 'fish' || id === 'shellfish' ? 'seafood' : id === 'egg' ? 'veg' : id || '';
}

// ─── Names ────────────────────────────────────────────────────────────────

/**
 * Breakfast plates and savory dishes whose names say cake or pie (pancakes,
 * crab cakes, pot pie, oatmeal ...): never desserts, so they never fire or
 * print as one.
 */
const SAVORY_CAKE_PIE =
  /pancake|flapjack|griddle ?cake|hot ?cake|waffle|french toast|oatmeal|porridge|(crab|fish|salmon|tuna|cod|shrimp|potato|rice|corn|zucchini|veggie|vegetable|quinoa|bean|johnny|hoe) ?cakes?\b|pot ?pie|shepherd'?s pie|cottage pie|(meat|pork|chicken|turkey|beef|steak|tamale|frito|pizza|savory|savoury) pies?\b|quiche/;

/** The name says cake or pie but it is a breakfast or savory dish (Lemon Ricotta Pancakes, Maryland Crab Cakes, Chicken Pot Pie). */
export function isSavoryCakeOrPie(name: string): boolean {
  return SAVORY_CAKE_PIE.test(name.toLowerCase());
}

/** A new dish's likely category from its name. */
export function guessCategory(name: string): RecipeCategory {
  const s = name.toLowerCase();
  if (
    /wine|beer|\bale\b|lager|\bipa\b|margarita|martini|mojito|spritz|cocktail|whisk|bourbon|vodka|\bgin\b|\brum\b|tequila|sangria|mimosa|champagne|prosecco|\btea\b|coffee|juice|lemonade|soda|smoothie|latte|\bmilk\b|cocoa|water/.test(
      s,
    )
  )
    return 'Drinks';
  const savory = isSavoryCakeOrPie(s);
  if (!savory && /cake|\bpies?\b|cookie|brownie|cobbler|pudding|ice cream|sundae|\btart\b|mousse|cheesecake|crisp|brulee|parfait/.test(s)) return 'Desserts';
  if (/fries|\brice\b|mashed|potato|vegetable|broccoli|slaw|\bcorn\b|beans|asparagus|\broll\b|sprouts|pilaf/.test(s)) return 'Sides';
  if (/soup|chowder|bisque|\bdip\b|bruschetta|wings|hummus|crostini|shrimp cocktail/.test(s)) return 'Starters';
  if (/popcorn|trail mix|granola bar|pretzel|\bchips\b|snack/.test(s)) return 'Snacks';
  return 'Entrees';
}

/** "COD · Salmon" reads "Catch of the Day (Salmon)" in Back Office. */
export function dishLong(name: string): string {
  const m = /^COD\s*·\s*(.+)$/.exec(name);
  return m ? `Catch of the Day (${m[1]})` : name;
}

export const ALLERGENS = ['Milk', 'Egg', 'Fish', 'Shellfish', 'Tree nuts', 'Peanuts', 'Wheat', 'Soy', 'Sesame'];

export const DIETS = ['Gluten-Friendly', 'Lactose Intolerant', 'Mechanical Altered', 'Nectar', 'No Salt Added', 'Pureed', 'Vegetarian', 'Heart-Healthy'];

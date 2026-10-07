/**
 * Item-level menu logic: categories, course numbers, drinks, default sides,
 * short names, modifier text and modifier upcharges.
 */
import { catalog, getItem, modifierRules, modPrefixes } from '../data';
import { DEFAULT_CONFIG, flag, type DiningConfig } from './config';
import type { MenuItem, ModSelection } from './types';

// ─── Categories and courses ──────────────────────────────────────────────

/** Sr: a side (anything listed under a "Sides" category). Sides follow their entrée. */
export function isSide(itemId: string): boolean {
  return /side/i.test(getItem(itemId)?.category ?? '');
}

/**
 * un: the course an item belongs to. 1 = starters and drinks, 2 = entrées
 * (and anything unclassified), 3 = desserts. An explicit course 0 counts as 1.
 */
export function itemCourse(itemId: string): number {
  const it = getItem(itemId);
  if (it?.course === 0) return 1;
  if (it?.course) return it.course;
  if (it?.entree) return 2;
  const c = it?.category ?? '';
  if (c === 'Starters' || c === 'Drinks' || c === 'Beverages') return 1;
  return c === 'Desserts' ? 3 : 2;
}

const DRINK_CATEGORIES = ['Drinks', 'Beverages', 'Alcohol', 'Cocktails'];
const ALCOHOL_CATEGORIES = ['Alcohol', 'Cocktails'];

/** __kNoAlc: alcohol-free products listed under the alcohol categories. */
export function isAlcoholFreeName(name: string | null | undefined): boolean {
  return /root beer|alcohol free|non-alcoholic|no alcohol|\bNA\b/i.test(name ?? '');
}

const drinkIds = new Set(catalog.filter((i) => DRINK_CATEGORIES.includes(i.category)).map((i) => i.id));
const boozeIds = new Set(
  catalog.filter((i) => ALCOHOL_CATEGORIES.includes(i.category) && !isAlcoholFreeName(i.name)).map((i) => i.id),
);

/** __kIsDrink: listed under a drink category on any meal's menu. */
export function isDrink(itemId: string): boolean {
  return drinkIds.has(itemId);
}

/** __kIsBooze: an alcoholic drink. */
export function isAlcohol(itemId: string): boolean {
  return boozeIds.has(itemId);
}

/**
 * __kDefSides: the sides an entrée comes with. The prototype's Back Office
 * could override these per menu placement; that editor is not ported, so
 * the item's own defaultSideIds are used.
 */
export function defaultSides(itemId: string): string[] {
  return getItem(itemId)?.defaultSideIds ?? [];
}

// ─── Short names ─────────────────────────────────────────────────────────

/**
 * Short operational names. The resident sees "Maple-Glazed Bone-in Pork
 * Chop"; the line sees "Pork Chop". Production reads this off the recipe.
 */
export const SHORT_NAMES: ReadonlyArray<[RegExp, string]> = [
  [/^Breakfast Burrito$/i, 'Bkfst Burrito'],
  [/^Breakfast Sandwich$/i, 'Bkfst Sandwich'],
  [/^Build Your Own Omelet$/i, 'BYO Omelet'],
  [/^Cold Cereal$/i, 'Cereal'],
  [/^Ham Steak Plate$/i, 'Ham Steak'],
  [/^Loaded Terrace Breakfast$/i, 'Loaded Bkfst'],
  [/^Strawberry Banana Pancakes$/i, 'SB Pancakes'],
  [/^Pureed Molded Meal$/i, 'Pureed Meal'],
  [/^Yogurt Parfait$/i, 'Parfait'],
  [/^BBQ Chicken Wings$/i, 'BBQ Wings'],
  [/^Build Your Own Deli Sandwich$/i, 'BYO Sandwich'],
  [/^Build Your Own Pizza$/i, 'BYO Pizza'],
  [/^Build Your Own Salad$/i, 'BYO Salad'],
  [/^COD · Wild Salmon$/i, 'COD Salmon'],
  [/^Breaded Flounder$/i, 'Flounder'],
  [/^Chicken Quesadilla$/i, 'Quesadilla'],
  [/^Classic Terrace Burger$/i, 'Terrace Burger'],
  [/^Orange Chicken Bowl$/i, 'Orange Chicken'],
  [/^PB & Jelly Sandwich$/i, 'PB & J'],
  [/^Southwest Summer Salad$/i, 'SW Salad'],
  [/^Spaghetti Bolognese$/i, 'Spag Bolognese'],
  [/^Reuben Sandwich$/i, 'Reuben'],
  [/^BBQ Chopped Chicken Salad$/i, 'BBQ Chx Salad'],
  [/^Peach Glazed Chicken Breast$/i, 'Peach Chicken'],
  [/^Cheese Stuffed Shells with Marinara$/i, 'Stuffed Shells'],
  [/^Applesauce Cup$/i, 'Applesauce'],
  [/^Avocado Slices$/i, 'Avocado'],
  [/^English Muffin$/i, 'Eng Muffin'],
  [/^Hashbrown Patty$/i, 'HB Patty'],
  [/^Mixed Berries$/i, 'Berries'],
  [/^2 Strips Bacon$/i, 'Bacon x2'],
  [/^2 Sausage Links$/i, 'Sausage x2'],
  [/^Carrot & Celery Sticks$/i, 'Carrot Celery'],
  [/^French Fries$/i, 'Fries'],
  [/^Sauteed Corn$/i, 'Corn'],
  [/^Sliced Tomatoes$/i, 'Tomatoes'],
  [/^Spinach & Mushrooms$/i, 'Spinach & Mush'],
  [/^Steamed Broccoli$/i, 'Broccoli'],
  [/^Sweet Potato Fries$/i, 'SP Fries'],
  [/^Creamy Potato Salad$/i, 'Potato Salad'],
  [/^Buttered Asparagus$/i, 'Asparagus'],
  [/^Garlic Green Beans$/i, 'Green Beans'],
  [/^Baked Roll$/i, 'Roll'],
  [/^Sugar-Free Jello$/i, 'SF Jello'],
  [/^Sugar-Free Cheesecake$/i, 'SF Cheesecake'],
  [/^Vanilla Ice Cream Cup$/i, 'Ice Cream'],
  [/^Pineapple Trifle$/i, 'Trifle'],
  [/^Decaf Coffee$/i, 'Decaf'],
  [/^Orange Juice$/i, 'OJ'],
  [/^Cranberry Juice$/i, 'Cran Juice'],
  [/^Coca-Cola$/i, 'Coke'],
  [/^Sugar-Free Lemonade$/i, 'SF Lemonade'],
  [/^Firestone 805 Blonde Ale$/i, '805'],
  [/^Blue Moon Belgian White Ale$/i, 'Blue Moon'],
  [/^Corona Extra Lager$/i, 'Corona'],
  [/^Modelo Especial Lager$/i, 'Modelo'],
  [/^Maple-Glazed Bone-in Pork Chop$/i, 'Pork Chop'],
  [/^Slow-Braised Short Ribs$/i, 'Short Ribs'],
  [/^Airline Chicken Marsala$/i, 'Chicken Marsala'],
  [/^Atlantic Salmon$/i, 'Salmon'],
  [/^New England Clam Chowder$/i, 'Clam Chowder'],
  [/^Banana Chocolate Chip Cookies$/i, 'Choc Chip Cookies'],
  [/^Eggplant Parmesan$/i, 'Eggplant Parm'],
  [/^Garden Vegetable Soup$/i, 'Veggie Soup'],
  [/^Chicken Tortilla Soup$/i, 'Tortilla Soup'],
  [/^Seasonal Vegetables$/i, 'Seasonal Veg'],
  [/^Two Eggs Any Style$/i, 'Two Eggs'],
  [/^Fresh Fruit Cup$/i, 'Fruit Cup'],
  [/^Roasted Tomato Basil Soup$/i, 'Tomato Soup'],
  [/^Chicken Noodle Soup$/i, 'Chx Noodle Soup'],
  [/^Heirloom Caprese Salad$/i, 'Caprese Salad'],
  [/^Strawberry & Spinach Salad$/i, 'Strawberry Salad'],
  [/^Springtime Salad$/i, 'Spring Salad'],
  [/^Cheeseburger on Bun$/i, 'Cheeseburger'],
  [/^Hamburger on Bun$/i, 'Hamburger'],
  [/^Crestavilla Classic Cheeseburger$/i, 'Classic Burger'],
  [/^Cheesy Herb & Garlic Chicken Wrap$/i, 'Chicken Wrap'],
  [/^Philly Cheesesteak Sandwich$/i, 'Philly Steak'],
  [/^BLT Sandwich$/i, 'BLT'],
  [/^Chicken Salad Sandwich$/i, 'Chx Salad Sand'],
  [/^Classic Turkey Sandwich$/i, 'Turkey Sandwich'],
  [/^Deli Ham Sandwich$/i, 'Ham Sandwich'],
  [/^Egg Salad Sandwich$/i, 'Egg Salad Sand'],
  [/^Grilled Cheese Sandwich$/i, 'Grilled Cheese'],
  [/^Tuna Melt Sandwich$/i, 'Tuna Melt'],
  [/^Tuna Salad Sandwich$/i, 'Tuna Salad Sand'],
  [/^Created Your Own Pasta$/i, 'Custom Pasta'],
  [/^Created Your Own Salad$/i, 'Custom Salad'],
  [/^Grilled Chicken Breast$/i, 'Grilled Chicken'],
  [/^Shrimp Scampi Pasta$/i, 'Shrimp Scampi'],
  [/^Pan-Seared Halibut$/i, 'Halibut'],
  [/^Sweet Potato Fries \(A\)$/i, 'SP Fries'],
  [/^Roasted Brussels Sprouts$/i, 'Brussels Sprouts'],
  [/^Add Protein: Salmon$/i, 'Add Salmon'],
  [/^Add Protein: Shrimp$/i, 'Add Shrimp'],
  [/^Add Protein: Chicken$/i, 'Add Chicken'],
  [/^Strawberry Salad with Chicken$/i, 'Strawberry Chx Salad'],
  [/^Add-On: side$/i, 'Extra Side'],
  [/^Fried Seafood Platter$/i, 'Seafood Platter'],
  [/^Buttermilk Pancakes$/i, 'Pancakes'],
  [/^Classico Mexican Lager Draft Beer$/i, 'Classico Draft'],
  [/^Mondavi Cabernet Sauvignon$/i, 'Cabernet Glass'],
  [/^BTL - Mondavi Cabernet Sauvignon$/i, 'Cabernet Bottle'],
  [/^Mondavi Pinot Noir$/i, 'Pinot Noir Glass'],
  [/^BTL - Mondavi Pinot Noir$/i, 'Pinot Noir Bottle'],
  [/^Mondavi Merlot$/i, 'Merlot Glass'],
  [/^BTL - Mondavi Merlot$/i, 'Merlot Bottle'],
  [/^Mondavi Chardonnay$/i, 'Chardonnay Glass'],
  [/^BTL - Mondavi Chardonnay$/i, 'Chardonnay Bottle'],
  [/^Glass of Blanc Mondavi$/i, 'Blanc Glass'],
  [/^Glass of Grigio Mondavi$/i, 'Pinot Grigio Glass'],
  [/^BTL - Butter Bubbles Sparkling$/i, 'Sparkling Bottle'],
  [/^Wine Alcohol Free Chardonnay$/i, 'NA Chardonnay Glass'],
  [/^BTL - Fre Chardonnay NA$/i, 'NA Chardonnay Bottle'],
  [/^Wine Alcohol Free Cab$/i, 'NA Cabernet Glass'],
  [/^BTL - Fre Cabernet No Alcohol$/i, 'NA Cabernet Bottle'],
  [/^Captain Morgan Rum$/i, 'Captain Morgan'],
  [/^Jim Bean Black Whiskey$/i, 'Jim Beam Black'],
  [/^Champagne \/ Mimosa$/i, 'Mimosa'],
  [/^Scotch on the Rocks$/i, 'Scotch Rocks'],
  [/^Captain & Lemonade$/i, 'Capt & Lemonade'],
];

/** __kShortName: a Back Office override, else the built-in short name, else the name. */
export function shortName(name: string, cfg: DiningConfig = DEFAULT_CONFIG): string {
  if (!name) return name;
  const override = cfg.shortNames[name];
  if (override) return override;
  for (const [re, short] of SHORT_NAMES) if (re.test(name)) return short;
  return name;
}

/** __kShortItem: the name kitchen screens show (short unless switched off). */
export function kitchenItemName(name: string, cfg: DiningConfig = DEFAULT_CONFIG): string {
  return flag(cfg, 'shortKitchen') ? shortName(name, cfg) : name;
}

/** __kShortSrv: the name server screens show (short unless switched off). */
export function serverItemName(name: string, cfg: DiningConfig = DEFAULT_CONFIG): string {
  return flag(cfg, 'shortServer') ? shortName(name, cfg) : name;
}

/** __kNm: an item's kitchen name by id ("item" when unknown). */
export function itemLabel(itemId: string, cfg: DiningConfig = DEFAULT_CONFIG): string {
  const it = getItem(itemId);
  return it ? kitchenItemName(it.name, cfg) : 'item';
}

// ─── Modifiers ───────────────────────────────────────────────────────────

/** Cl: every chosen modifier value as a flat list. */
export function flattenMods(mods: ModSelection | string[] | null | undefined): string[] {
  if (!mods) return [];
  if (Array.isArray(mods)) return mods;
  const out: string[] = [];
  for (const v of Object.values(mods)) {
    if (Array.isArray(v)) out.push(...v);
    else if (v) out.push(v);
  }
  return out;
}

/**
 * __kModNames: the option names a line asked for, with prefixes stripped:
 * "Xtra Bacon" → "Bacon", "No Onions" is dropped, "Add ..." is kept whole.
 */
export function modNames(mods: ModSelection | string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of flattenMods(mods)) {
    const s = String(raw);
    const word = s.split(' ')[0];
    if (modPrefixes.includes(word) && word !== 'Add') {
      if (word !== 'No') out.push(s.slice(word.length + 1));
    } else out.push(s);
  }
  return out;
}

/**
 * __kChosenMods: hide defaults the server did not change, so only real
 * choices print under an item (unless the hideDefaults flag is off).
 */
export function chosenMods(
  mods: ModSelection | undefined,
  item: MenuItem | undefined,
  cfg: DiningConfig = DEFAULT_CONFIG,
): ModSelection | undefined {
  if (!flag(cfg, 'hideDefaults') || !mods) return mods;
  const groups = (item?.mods ?? []).filter((g) => g.default != null);
  const defaults = new Set(groups.map((g) => g.group + '\u0000' + g.default));
  const out: ModSelection = {};
  for (const [g, v] of Object.entries(mods)) {
    if (!defaults.has(g + '\u0000' + String(v))) out[g] = v;
  }
  return out;
}

/** __kModsText: "Grilled · Chopped · Sauce on the side". Skips Notes and "None". */
export function modsText(mods: ModSelection | null | undefined, note?: string): string {
  const parts = Object.entries(mods ?? {})
    .filter(
      ([g, v]) =>
        g !== 'Notes' && v != null && v !== '' && !/^none$/i.test(String(v)) && !(Array.isArray(v) && !v.length),
    )
    .map(([, v]) => (Array.isArray(v) ? v.join(', ') : String(v)));
  if (note) parts.push(note);
  return parts.join(' · ');
}

export interface UpchargeLine {
  text: string;
  amt: number;
}

/**
 * __kUpLines: what a line's modifier picks add to its price. Only groups
 * with ordering rules price anything, so a check that never used rules
 * prices exactly as before them: priced options, plus a per-pick charge for
 * picks past the included count (pizza toppings).
 */
export function upchargeLines(line: { itemId?: string; mods?: ModSelection }): UpchargeLine[] {
  const groupIds = (line.itemId && modifierRules.items[line.itemId]) || [];
  if (!groupIds.length) return [];
  const names = modNames(line.mods);
  const out: UpchargeLine[] = [];
  for (const gid of groupIds) {
    const g = modifierRules.groups[gid];
    if (!g) continue;
    const picked = g.options.filter((o) => names.includes(o.name));
    for (const o of picked) if (o.price && o.price > 0) out.push({ text: o.name, amt: o.price });
    const extraPicks = g.rule.extra > 0 ? Math.max(0, picked.length - (g.rule.included ?? 0)) : 0;
    if (extraPicks) {
      const label = (g.rule.label || g.name).toLowerCase();
      out.push({
        text: `${extraPicks} extra ${extraPicks === 1 ? label.replace(/s$/, '') : label}`,
        amt: extraPicks * g.rule.extra,
      });
    }
  }
  return out;
}

/** __kUp: total modifier upcharge on a line. */
export function upcharge(line: { itemId?: string; mods?: ModSelection }): number {
  return upchargeLines(line).reduce((sum, x) => sum + x.amt, 0);
}

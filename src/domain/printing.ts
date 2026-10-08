/**
 * Printer mode: which printer prints which items. A printer prints the whole
 * ticket, or only what it is set to, at three levels:
 *
 * - groups: Beverages, Alcohol, Starters, Entrées, Sides, Desserts;
 * - categories: a Recipe Book subcategory within a group ("Entrées/Sandwiches");
 * - recipes: one dish.
 *
 * The most specific setting wins: a recipe picked for a printer prints there
 * and not at the printers that take its category or group, and a category
 * picked for a printer prints there and not at the printers that take its
 * group. Whole-ticket printers always print everything. Every printer with
 * something to print gets one ticket when the server sends.
 */

/** The groups a printer can be set to, in menu order. */
export const PRINT_GROUPS = ['Beverages', 'Alcohol', 'Starters', 'Entrées', 'Sides', 'Desserts'] as const;
export type PrintGroup = (typeof PRINT_GROUPS)[number];

/** Recipe Book drink subcategories that are alcohol; every other drink is a beverage. */
export const ALCOHOL_SUBS = ['Wine', 'Beer', 'Spirits / Liquor', 'Cocktails'];

/** The first version had one Drinks group; a saved pick of it means both. */
const LEGACY: Record<string, PrintGroup[]> = { Drinks: ['Beverages', 'Alcohol'] };
const upgradeGroups = (gs: readonly string[]): PrintGroup[] => PRINT_GROUPS.filter((g) => gs.includes(g) || gs.some((x) => LEGACY[x]?.includes(g)));

/** What a printer prints when it doesn't take the whole ticket. */
export interface PrintPick {
  groups: PrintGroup[];
  /** Category keys: "<group>/<subcategory>", e.g. "Entrées/Sandwiches". */
  subs: string[];
  /** Recipe ids. */
  recipes: string[];
}

/** What a printer prints: 'all' for the whole ticket, or its picks (all empty prints nothing). */
export type PrintRoute = 'all' | PrintPick;

/** The printer fields this needs. A saved list of groups (the first version) still reads. */
export interface RoutedPrinter {
  id: string;
  name: string;
  type: string;
  reachable: boolean;
  print?: PrintRoute | string[];
}

/** One item on a ticket, as routing sees it. */
export interface PrintItem {
  name: string;
  group: PrintGroup;
  /** Its category key ("Entrées/Soup"), when its recipe has a subcategory. */
  sub?: string;
  recipeId?: string;
}

export const EMPTY_PICK: PrintPick = { groups: [], subs: [], recipes: [] };

/** Menu category (as the tablet menu lists it) or Recipe Book category → print group. */
const GROUP_OF: Record<string, PrintGroup> = {
  Drinks: 'Beverages',
  Beverages: 'Beverages',
  Alcohol: 'Alcohol',
  Cocktails: 'Alcohol',
  Starters: 'Starters',
  Specials: 'Entrées',
  Entrées: 'Entrées',
  Entrees: 'Entrées',
  Snacks: 'Entrées',
  Sides: 'Sides',
  'Add-Ons': 'Sides',
  Desserts: 'Desserts',
};

/**
 * The print group of a category; anything unknown counts as an entrée. A
 * Recipe Book drink is alcohol when its subcategory is wine, beer, spirits or
 * a cocktail.
 */
export function printGroupOf(category: string | undefined, sub?: string): PrintGroup {
  const g = (category && GROUP_OF[category]) || 'Entrées';
  return g === 'Beverages' && sub && ALCOHOL_SUBS.includes(sub) ? 'Alcohol' : g;
}

/** "Entrées/Sandwiches" */
export const subKey = (group: PrintGroup, sub: string) => `${group}/${sub}`;
/** "Sandwiches" from "Entrées/Sandwiches" */
export const subLabel = (key: string) => key.slice(key.indexOf('/') + 1);

/** What a printer prints; when nobody has set it, kitchen and receipt printers print the whole ticket and label printers nothing. */
export function printRoute(p: RoutedPrinter): PrintRoute {
  const r = p.print;
  if (r === 'all') return 'all';
  if (Array.isArray(r)) return { ...EMPTY_PICK, groups: upgradeGroups(r) };
  if (r) return { groups: upgradeGroups(r.groups ?? []), subs: r.subs ?? [], recipes: r.recipes ?? [] };
  return p.type === 'Label' ? EMPTY_PICK : 'all';
}

export const printsWhole = (p: RoutedPrinter) => printRoute(p) === 'all';

/** How specifically a printer takes an item: 3 by recipe, 2 by category, 1 by group, 0 not at all. */
function level(pick: PrintPick, item: PrintItem): number {
  if (item.recipeId && pick.recipes.includes(item.recipeId)) return 3;
  if (item.sub && pick.subs.includes(item.sub)) return 2;
  return pick.groups.includes(item.group) ? 1 : 0;
}

/** The printers an item prints at: every whole-ticket printer, plus the most specific of the rest. */
export function printersFor(item: PrintItem, printers: RoutedPrinter[]): RoutedPrinter[] {
  const scored = printers.map((p) => {
    const r = printRoute(p);
    return { p, whole: r === 'all', lv: r === 'all' ? 0 : level(r, item) };
  });
  const best = Math.max(0, ...scored.map((x) => x.lv));
  return scored.filter((x) => x.whole || (best > 0 && x.lv === best)).map((x) => x.p);
}

/** Groups no printer takes whole: their items print only where a category or recipe of theirs is picked. */
export function unprintedGroups(
  printers: RoutedPrinter[],
  /** Each picked recipe's group, so a recipe only counts for its own group. */
  recipeGroup: (recipeId: string) => PrintGroup | undefined = () => undefined,
): Array<{ group: PrintGroup; partly: boolean }> {
  const routes = printers.map(printRoute);
  if (routes.includes('all')) return [];
  const picks = routes as PrintPick[];
  return PRINT_GROUPS.filter((g) => !picks.some((r) => r.groups.includes(g))).map((g) => ({
    group: g,
    partly: picks.some((r) => r.subs.some((k) => k.startsWith(g + '/')) || r.recipes.some((id) => recipeGroup(id) === g)),
  }));
}

export interface PrintJob {
  printer: RoutedPrinter;
  /** The item names on this ticket. */
  items: string[];
  whole: boolean;
}

/** The tickets one send prints: one per printer with something on it, in printer order. */
export function printJobs(items: PrintItem[], printers: RoutedPrinter[]): PrintJob[] {
  const at = new Map<string, string[]>();
  for (const it of items) for (const p of printersFor(it, printers)) at.set(p.id, [...(at.get(p.id) ?? []), it.name]);
  return printers.flatMap((printer) => {
    const mine = at.get(printer.id);
    return mine ? [{ printer, items: mine, whole: printsWhole(printer) }] : [];
  });
}

/**
 * "Printed at Hot Line (2 items) · Expo Receipt (whole ticket)", for the
 * confirmation after Send. A printer that can't be reached printed nothing,
 * so it is named apart: "… · Not printed: Expo Receipt can't be reached".
 */
export function printSummary(jobs: PrintJob[]): string {
  if (!jobs.length) return 'Nothing printed: no printer is set to print these items';
  const ok = jobs.filter((j) => j.printer.reachable);
  const down = jobs.filter((j) => !j.printer.reachable).map((j) => j.printer.name);
  const printed = ok.length
    ? 'Printed at ' + ok.map((j) => `${j.printer.name} (${j.whole ? 'whole ticket' : `${j.items.length} item${j.items.length === 1 ? '' : 's'}`})`).join(' · ')
    : 'Nothing printed';
  return down.length ? `${printed} · Not printed: ${down.join(' and ')} can't be reached` : printed;
}

/** Items no printer takes: they print nowhere, so someone has to tell the kitchen. */
export function unprintedItems(items: PrintItem[], printers: RoutedPrinter[]): PrintItem[] {
  return items.filter((it) => printersFor(it, printers).length === 0);
}

// ─── Item-level rules (Printers page, By menu item) ─────────────────────

/** The printers that take one recipe by name (an item-level rule), in printer order. Whole-ticket printers aren't listed. */
export function itemPrinterIds(printers: RoutedPrinter[], recipeId: string): string[] {
  return printers
    .filter((p) => {
      const r = printRoute(p);
      return r !== 'all' && r.recipes.includes(recipeId);
    })
    .map((p) => p.id);
}

/**
 * Send one recipe to exactly these printers: it joins their recipe picks and
 * leaves every other printer's, so it prints there (plus at the whole-ticket
 * printers) and nowhere else. No printers puts it back to automatic: it
 * prints wherever its category or group does. Whole-ticket printers keep
 * printing everything and are left as they are. Returns the printers with
 * their new routes; a printer whose route doesn't change is returned as is.
 */
export function setItemPrinters<P extends RoutedPrinter>(printers: P[], recipeId: string, printerIds: string[]): P[] {
  const chosen = new Set(printerIds);
  return printers.map((p) => {
    const r = printRoute(p);
    if (r === 'all') return p;
    const has = r.recipes.includes(recipeId);
    const want = chosen.has(p.id);
    if (has === want) return p;
    const recipes = want ? [...r.recipes, recipeId] : r.recipes.filter((id) => id !== recipeId);
    return { ...p, print: { ...r, recipes } };
  });
}

// ─── What a change sent to the kitchen ───────────────────────────────────

/** The fields of a line that say whether the kitchen has it. */
type FiredLine = { id: string; sent: boolean; kitchenState: string | null; cancelled?: boolean };

/** In the kitchen's hands: sent, not waiting for its course or fire time, and not something nobody makes (a fee). */
const reachedKitchen = (l: FiredLine) => l.sent && !l.cancelled && l.kitchenState != null && l.kitchenState !== 'scheduled' && l.kitchenState !== 'cleared';

/**
 * Lines a change put in front of the kitchen: on the order now, and before
 * it either unsent, held for a course or fire time, or not there at all (a
 * remake). In printer mode each of these prints, whatever sent it: the
 * server's Send, a released hold, the kiosk, or a scheduled pick up firing.
 */
export function newlyFired<L extends FiredLine>(before: { diners: Array<{ items: FiredLine[] }> } | undefined, after: { diners: Array<{ items: L[] }> }): L[] {
  const was = new Map((before?.diners ?? []).flatMap((d) => d.items.map((l) => [l.id, l] as const)));
  return after.diners.flatMap((d) =>
    d.items.filter((l) => {
      if (!reachedKitchen(l)) return false;
      const prev = was.get(l.id);
      return !prev || !prev.sent || prev.kitchenState === 'scheduled';
    }),
  );
}

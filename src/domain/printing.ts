/**
 * Printer mode: which printer prints which items. A printer prints the whole
 * ticket, or only the groups it is set to (the hot line gets entrées and
 * sides, the pantry gets starters and desserts). Every printer that has
 * something to print gets one ticket when the server sends.
 */

/** The groups a printer can be set to, in menu order. */
export const PRINT_GROUPS = ['Drinks', 'Starters', 'Entrées', 'Sides', 'Desserts'] as const;
export type PrintGroup = (typeof PRINT_GROUPS)[number];

/** What a printer prints: 'all' for the whole ticket, or a list of groups (empty prints nothing). */
export type PrintRoute = 'all' | PrintGroup[];

/** The printer fields this needs. */
export interface RoutedPrinter {
  id: string;
  name: string;
  type: string;
  reachable: boolean;
  print?: PrintRoute;
}

/** Menu category (as the tablet menu lists it) → print group. */
const GROUP_OF: Record<string, PrintGroup> = {
  Drinks: 'Drinks',
  Beverages: 'Drinks',
  Alcohol: 'Drinks',
  Cocktails: 'Drinks',
  Starters: 'Starters',
  Specials: 'Entrées',
  Entrées: 'Entrées',
  Entrees: 'Entrées',
  Sides: 'Sides',
  'Add-Ons': 'Sides',
  Desserts: 'Desserts',
};

/** The print group of a menu category; anything unknown counts as an entrée. */
export const printGroupOf = (category: string | undefined): PrintGroup => (category && GROUP_OF[category]) || 'Entrées';

/** What a printer prints when nobody has set it: kitchen and receipt printers the whole ticket, label printers nothing. */
export function printRoute(p: RoutedPrinter): PrintRoute {
  return p.print ?? (p.type === 'Label' ? [] : 'all');
}

export const printsWhole = (p: RoutedPrinter) => printRoute(p) === 'all';

/** Does this printer print items of this group? */
export function printsGroup(p: RoutedPrinter, g: PrintGroup): boolean {
  const r = printRoute(p);
  return r === 'all' || r.includes(g);
}

/** Groups no printer prints, so those items would never reach the kitchen on paper. */
export function unprintedGroups(printers: RoutedPrinter[]): PrintGroup[] {
  return PRINT_GROUPS.filter((g) => !printers.some((p) => printsGroup(p, g)));
}

export interface PrintJob {
  printer: RoutedPrinter;
  /** The item names on this ticket. */
  items: string[];
  whole: boolean;
}

/** The tickets one send prints: one per printer with something on it. */
export function printJobs(items: Array<{ name: string; category?: string }>, printers: RoutedPrinter[]): PrintJob[] {
  return printers.flatMap((printer) => {
    const mine = items.filter((it) => printsGroup(printer, printGroupOf(it.category)));
    return mine.length ? [{ printer, items: mine.map((it) => it.name), whole: printsWhole(printer) }] : [];
  });
}

/** "Hot Line: 2 items · Expo Receipt: whole ticket", for the confirmation after Send. */
export function printSummary(jobs: PrintJob[]): string {
  if (!jobs.length) return 'Nothing printed: no printer is set to print these items';
  return (
    'Printed at ' +
    jobs.map((j) => `${j.printer.name} (${j.whole ? 'whole ticket' : `${j.items.length} item${j.items.length === 1 ? '' : 's'}`})`).join(' · ')
  );
}

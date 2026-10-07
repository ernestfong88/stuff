import { describe, expect, it } from 'vitest';
import { printGroupOf, printJobs, printRoute, printSummary, printersFor, unprintedGroups, type PrintItem, type RoutedPrinter } from '../printing';

const hot: RoutedPrinter = { id: 'p1', name: 'Hot Line', type: 'Kitchen', reachable: true, print: ['Entrées', 'Sides'] };
const cold: RoutedPrinter = {
  id: 'p2',
  name: 'Pantry',
  type: 'Kitchen',
  reachable: true,
  print: { groups: ['Starters', 'Desserts'], subs: ['Entrées/Entrée Salad'], recipes: [] },
};
const grill: RoutedPrinter = { id: 'p4', name: 'Grill', type: 'Kitchen', reachable: true, print: { groups: [], subs: [], recipes: ['burger'] } };
const pass: RoutedPrinter = { id: 'p3', name: 'Expo', type: 'Receipt', reachable: true };
const label: RoutedPrinter = { id: 'p5', name: 'Labels', type: 'Label', reachable: true };

const soup: PrintItem = { name: 'Soup', group: 'Starters', sub: 'Starters/Soup' };
const salmon: PrintItem = { name: 'Salmon', group: 'Entrées', sub: 'Entrées/Plates' };
const cobb: PrintItem = { name: 'Cobb', group: 'Entrées', sub: 'Entrées/Entrée Salad' };
const burger: PrintItem = { name: 'Burger', group: 'Entrées', sub: 'Entrées/Sandwiches', recipeId: 'burger' };
const rice: PrintItem = { name: 'Rice', group: 'Sides' };
const pie: PrintItem = { name: 'Pie', group: 'Desserts' };

const names = (ps: RoutedPrinter[]) => ps.map((p) => p.name);

describe('printer routing', () => {
  it('maps menu and Recipe Book categories to print groups', () => {
    expect(printGroupOf('Specials')).toBe('Entrées');
    expect(printGroupOf('Add-Ons')).toBe('Sides');
    expect(printGroupOf('Cocktails')).toBe('Alcohol');
    expect(printGroupOf('Drinks')).toBe('Beverages');
    expect(printGroupOf('Drinks', 'Wine')).toBe('Alcohol');
    expect(printGroupOf('Drinks', 'Coffee & Tea')).toBe('Beverages');
    expect(printGroupOf('Entrees')).toBe('Entrées');
  });

  it('reads a saved list of groups as group picks', () => {
    expect(printRoute(hot)).toEqual({ groups: ['Entrées', 'Sides'], subs: [], recipes: [] });
    expect(printRoute(label)).toEqual({ groups: [], subs: [], recipes: [] });
    // The old single Drinks group means both beverages and alcohol.
    expect(printRoute({ ...hot, print: ['Drinks'] })).toEqual({ groups: ['Beverages', 'Alcohol'], subs: [], recipes: [] });
    expect(printRoute(pass)).toBe('all');
  });

  it('lets the most specific pick win, and whole-ticket printers get everything', () => {
    const all = [hot, cold, grill, pass];
    expect(names(printersFor(salmon, all))).toEqual(['Hot Line', 'Expo']);
    expect(names(printersFor(cobb, all))).toEqual(['Pantry', 'Expo']); // category beats group
    expect(names(printersFor(burger, all))).toEqual(['Grill', 'Expo']); // recipe beats group
    expect(names(printersFor(burger, [hot]))).toEqual(['Hot Line']);
  });

  it('splits a ticket by printer', () => {
    const jobs = printJobs([soup, salmon, cobb, burger, rice, pie], [hot, cold, grill, pass, label]);
    expect(jobs.map((j) => [j.printer.name, j.items])).toEqual([
      ['Hot Line', ['Salmon', 'Rice']],
      ['Pantry', ['Soup', 'Cobb', 'Pie']],
      ['Grill', ['Burger']],
      ['Expo', ['Soup', 'Salmon', 'Cobb', 'Burger', 'Rice', 'Pie']],
    ]);
    expect(printSummary(jobs)).toBe('Printed at Hot Line (2 items) · Pantry (3 items) · Grill (1 item) · Expo (whole ticket)');
  });

  it('finds groups no printer takes whole', () => {
    expect(unprintedGroups([hot, cold])).toEqual([
      { group: 'Beverages', partly: false },
      { group: 'Alcohol', partly: false },
    ]);
    expect(unprintedGroups([cold])).toEqual([
      { group: 'Beverages', partly: false },
      { group: 'Alcohol', partly: false },
      { group: 'Entrées', partly: true },
      { group: 'Sides', partly: false },
    ]);
    expect(unprintedGroups([pass])).toEqual([]);
    // A recipe only counts for its own group.
    expect(unprintedGroups([grill], (id) => (id === 'burger' ? 'Entrées' : undefined)).filter((g) => g.partly)).toEqual([
      { group: 'Entrées', partly: true },
    ]);
  });
});
